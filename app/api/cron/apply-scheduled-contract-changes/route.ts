import { revalidatePublicData } from "@/lib/revalidate";
import {deliverMatchingNotifications} from "@/lib/matching-notification-delivery";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { applyContractBillingChange, isPaymentPendingError, CARD_GRACE_DAYS } from "@/lib/contracts-billing";
import { chargeOnce, periodGroupKey, reconcileStaleAttempts } from "@/lib/payment-ledger";
import { addMonthsAnchored, jstDateOf, jstMidnightIso, renewedPeriodEnd } from "@/lib/billing-dates";
import { finalizeDueCancellations } from "@/lib/contract-cancel";
import { startCronRun, finishCronRun, checkCronAlive, type CronFailure } from "@/lib/cron-run";
import { sendCardPaymentFailedEmail, sendPaymentReceiptEmail } from "@/lib/email";
import { notifyStoreLine, PLAN_PAGE_URL, yen } from "@/lib/store-line";


// ============================================================================
// Vercel Cronから毎日呼ばれる、「期間終了時に予約されたプラン・アドオンの
// ダウングレード/解除」を実際に適用するジョブ(2026/10新設)。
//
// 店舗が店舗管理画面から金額の下がる変更をリクエストすると、即座には
// 反映されず store_contracts.pending_plan_id / pending_plan_effective_at
// や store_contract_addons.pending_removed_at に「予約」として記録される
// だけになる(lib/contracts-billing.ts の schedulePlanDowngrade /
// scheduleAddonRemovals)。このジョブは、予約の適用日時(effective_at)が
// 過ぎた契約を見つけて、新しい(低い)金額で改めて決済してから実際に
// 切り替える。
//
// 認証: Vercel Cronからのリクエストは Authorization: Bearer $CRON_SECRET
// を自動で付与してくる。それ以外からの呼び出しは拒否する。
// ============================================================================

export const maxDuration = 300;
export const dynamic = "force-dynamic"; // 毎回データベースの最新を読む(キャッシュしない)

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    revalidatePublicData(); // 掲載状態の変化をTOP・一覧へすぐ反映
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startCronRun("card-billing");
  const failures: CronFailure[] = [];
  // Retry the durable notification outbox without interfering with billing.
  await deliverMatchingNotifications().catch((e) => {
    failures.push({ step: "マッチング通知の再送", detail: e instanceof Error ? e.message : String(e) });
  });
  const supabase = createServiceRoleClient();
  // 前回までに結果が分からなかった決済を、KOMOJUに問い合わせて確定させる(決済済みなら下の更新処理で期間だけ延びる)
  const reconciled = await reconcileStaleAttempts().catch((e) => {
    failures.push({ step: "結果不明の決済の確認", detail: e instanceof Error ? e.message : String(e) });
    return [] as Array<{ id: string; status: string; detail: string }>;
  });
  for (const r of reconciled) if (r.status === "unknown") failures.push({ step: "決済の結果がまだ確認できない", id: r.id, detail: r.detail });
  const nowIso = new Date().toISOString();

  // 解約予定で契約期間が終わった契約を終了する(店舗ページ・ログインの削除。lib/contract-cancel.ts)
  const cancellations = await finalizeDueCancellations().catch((e) => {
    failures.push({ step: "解約の終了処理", detail: e instanceof Error ? e.message : String(e) });
    return [] as Array<{ id: string; ok: boolean; detail?: string }>;
  });
  for (const r of cancellations) if (!r.ok) failures.push({ step: "解約の終了処理", id: r.id, detail: r.detail ?? "" });

  // 対象1: プランのダウングレード予約が適用日時を過ぎている契約。
  const { data: duePlanContracts, error: planError } = await supabase
    .from("store_contracts")
    .select("id")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .not("pending_plan_id", "is", null)
    .lte("pending_plan_effective_at", nowIso);
  if (planError) {
    await finishCronRun(runId, "card-billing", { jobLabel: "カード決済・契約更新", summary: {}, failures: [...failures, { step: "契約の読み込み", detail: planError.message }] });
    return NextResponse.json({ error: planError.message }, { status: 500 });
  }

  // 対象2: アドオンの解除予約が適用日時を過ぎているものを持つ契約。
  const { data: dueAddonRows, error: addonError } = await supabase
    .from("store_contract_addons")
    .select("store_contract_id")
    .eq("billing_method", "card")
    .is("fincode_subscription_id", null)
    .not("pending_removed_at", "is", null)
    .lte("pending_removed_at", nowIso);
  if (addonError) {
    await finishCronRun(runId, "card-billing", { jobLabel: "カード決済・契約更新", summary: {}, failures: [...failures, { step: "アドオンの読み込み", detail: addonError.message }] });
    return NextResponse.json({ error: addonError.message }, { status: 500 });
  }

  // カード払い契約の自動更新: 契約期間が終わったものは、今の構成(プラン+カード払いの月額アドオン)で決済する
  const { data: dueRenewals, error: renewalError } = await supabase
    .from("store_contracts")
    .select("id")
    .eq("status", "active")
    .eq("cancel_at_period_end", false) // 解約予定の契約は更新しない(期間の終わりで終了)
    .or("billing_method.is.null,billing_method.eq.card")
    .not("fincode_customer_id", "is", null)
    .not("fincode_customer_id", "like", "session:%")
    .lte("current_period_end", nowIso);
  if (renewalError) {
    await finishCronRun(runId, "card-billing", { jobLabel: "カード決済・契約更新", summary: {}, failures: [...failures, { step: "更新対象の読み込み", detail: renewalError.message }] });
    return NextResponse.json({ error: renewalError.message }, { status: 500 });
  }

  const contractIds = Array.from(
    new Set([
      ...(duePlanContracts ?? []).map((c) => c.id as string),
      ...(dueAddonRows ?? []).map((a) => a.store_contract_id as string),
      ...(dueRenewals ?? []).map((c) => c.id as string),
    ])
  );

  const results: Array<{ storeContractId: string; ok: boolean; detail?: string; chargedAmount?: number }> = [];

  for (const storeContractId of contractIds) {
    try {
      const { data: contract, error: contractFetchError } = await supabase
        .from("store_contracts")
        .select("id, store_id, plan_id, pending_plan_id, pending_plan_effective_at, status, cancel_at_period_end, billing_method, current_period_end, contact_email, suspended_for_nonpayment_at, stores(name, status)")
        .eq("id", storeContractId)
        .single();
      if (contractFetchError || !contract) throw new Error(contractFetchError?.message ?? "契約が見つかりません。");
      if (contract.status !== "active") continue;
      if ((contract as any).cancel_at_period_end) continue; // 解約予定: 決済しない
      // 銀行振込の契約はカード決済しない(次回分の請求書で切り替える。app/api/cron/bank-transfer)
      if (contract.billing_method === "bank_transfer") continue;

      const planIsDue = !!contract.pending_plan_id && !!contract.pending_plan_effective_at && contract.pending_plan_effective_at <= nowIso;
      const finalPlanId = planIsDue ? (contract.pending_plan_id as string) : (contract.plan_id as string);

      const { data: addonRows, error: addonFetchError } = await supabase
        .from("store_contract_addons")
        .select("addon_id, pending_removed_at")
        .eq("store_contract_id", storeContractId)
        .eq("billing_method", "card")
        .is("fincode_subscription_id", null);
      if (addonFetchError) throw new Error(addonFetchError.message);

      const finalAddonIds = (addonRows ?? [])
        .filter((a) => !(a.pending_removed_at && a.pending_removed_at <= nowIso))
        .map((a) => a.addon_id as string);

      if (!finalPlanId) {
        results.push({ storeContractId, ok: false, detail: "プランが設定されていません。" });
        continue;
      }

      const isRenewal = !!contract.current_period_end && contract.current_period_end <= nowIso;
      // 二重決済の防止: 直近25日以内に更新の決済が成功しているのに期間が延びていない場合
      // (決済後の保存に失敗した等)は、もう一度決済せずに期間だけ直す
      if (isRenewal) {
        const since = new Date(Date.now() - 25 * 86400_000).toISOString();
        const { data: recent } = await supabase
          .from("billing_events")
          .select("occurred_at")
          .eq("store_contract_id", storeContractId)
          .eq("event_type", "success")
          .eq("source", "card_renewal")
          .like("note", "契約更新の決済%") // アドオン単独の更新(同じ source)は除く
          .gte("occurred_at", since)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recent?.occurred_at) {
          // 決済した日(日本時間)から1か月後の同じ日を次の更新日にする
          const paidDay = jstDateOf(recent.occurred_at as string);
          const d = new Date(jstMidnightIso(addMonthsAnchored(paidDay, 1)));
          await supabase.from("store_contracts").update({ current_period_end: d.toISOString(), billing_anchor_day: Number(paidDay.slice(8, 10)) }).eq("id", storeContractId);
          await supabase.from("audit_log").insert({
            action: "card_renewal_double_charge_prevented",
            target_type: "store_contract",
            target_id: storeContractId,
            detail: { lastSuccessAt: recent.occurred_at, fixedPeriodEnd: d.toISOString() },
          });
          results.push({ storeContractId, ok: true, detail: "直近に決済済みのため再決済せず期間を修正" });
          continue;
        }
      }
      try {
        const { chargedAmount } = await applyContractBillingChange({
          storeContractId,
          newPlanId: finalPlanId,
          newAddonIds: finalAddonIds,
          resolvesPendingPlan: planIsDue,
          source: isRenewal ? "card_renewal" : "contract_change",
        });
        results.push({ storeContractId, ok: true, chargedAmount });
      } catch (chargeError) {
        // 決済したか分からない(処理中・結果不明): 失敗扱いにしない(掲載停止もしない)。運営が確認する
        if (isPaymentPendingError(chargeError)) {
          results.push({ storeContractId, ok: false, detail: `結果確認待ち: ${chargeError.message}` });
          continue;
        }
        // 決済できなかった: 毎日再試行し、猶予日数を過ぎたら掲載を止める(決済できた時点で再開)
        if (isRenewal) await handleRenewalFailure(supabase, contract as any);
        throw chargeError;
      }
    } catch (e) {
      results.push({ storeContractId, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  // アドオン単独で毎月カード決済している行(fincode_subscription_id = own_billing)の更新
  const addonResults = await renewOwnBilledAddons(supabase, nowIso).catch((e) => {
    failures.push({ step: "アドオンの更新", detail: e instanceof Error ? e.message : String(e) });
    return [] as Array<{ id: string; ok: boolean; detail?: string }>;
  });

  revalidatePublicData(); // 掲載状態の変化をTOP・一覧へすぐ反映

  for (const r of results) if (!r.ok) failures.push({ step: "契約の更新・変更の決済", id: r.storeContractId, detail: r.detail ?? "" });
  for (const r of addonResults) if (!r.ok) failures.push({ step: "アドオン更新の決済", id: r.id, detail: r.detail ?? "" });
  // もう一方の自動処理(振込の請求)が止まっていないか
  const alive = await checkCronAlive("bank-transfer", "振込の請求・入金確認", 30).catch(() => null);
  if (alive) failures.push(alive);
  const summary = {
    processed: results.length,
    charged: results.filter((r) => r.ok && r.chargedAmount).length,
    addonRenewed: addonResults.filter((r) => r.ok).length,
    reconciled: reconciled.length,
    canceledContracts: cancellations.filter((r) => r.ok).length,
  };
  await finishCronRun(runId, "card-billing", { jobLabel: "カード決済・契約更新", summary, failures });

  return NextResponse.json({ ...summary, results, addonResults, reconciled });
}

type Supa = ReturnType<typeof createServiceRoleClient>;

function jstDateLabel(iso: string) {
  const d = new Date(Date.parse(iso) + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function handleRenewalFailure(
  supabase: Supa,
  contract: { id: string; store_id: string; current_period_end: string; contact_email: string | null; suspended_for_nonpayment_at: string | null; stores: any }
) {
  const store = (Array.isArray(contract.stores) ? contract.stores[0] : contract.stores) as { name?: string; status?: string } | null;
  const suspendAt = new Date(Date.parse(contract.current_period_end) + CARD_GRACE_DAYS * 86400_000);

  if (Date.now() >= suspendAt.getTime()) {
    if (!contract.suspended_for_nonpayment_at && (store?.status === "approved" || store?.status === "listed")) {
      await supabase
        .from("store_contracts")
        .update({ suspended_for_nonpayment_at: new Date().toISOString(), store_status_before_suspension: store.status })
        .eq("id", contract.id);
      await supabase.from("stores").update({ status: "payment_suspended" }).eq("id", contract.store_id);
      await notifyStoreLine(
        { storeId: contract.store_id },
        `カード決済が確認できなかったため、店舗ページの掲載を一時停止しました。カードを登録し直すと、すぐに決済して掲載を再開します。\n${PLAN_PAGE_URL}`
      );
      await supabase.from("audit_log").insert({
        action: "store_suspended_for_card_failure",
        target_type: "store",
        target_id: contract.store_id,
        detail: { storeContractId: contract.id, previousStatus: store.status },
      });
    }
    return;
  }

  // 猶予期間中: 失敗したことを店舗に知らせる(初回と、停止の前日)
  const daysLate = Math.floor((Date.now() - Date.parse(contract.current_period_end)) / 86400_000);
  if (contract.contact_email && (daysLate === 0 || daysLate === CARD_GRACE_DAYS - 1)) {
    const { data: last } = await supabase
      .from("billing_events")
      .select("amount")
      .eq("store_contract_id", contract.id)
      .eq("event_type", "failed")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await notifyStoreLine(
      { storeId: contract.store_id },
      `ご登録のカードで掲載料金の決済ができませんでした。${jstDateLabel(suspendAt.toISOString())}までにカード情報の登録し直しをお願いします（それまでに決済できない場合は掲載を一時停止します）。\n${PLAN_PAGE_URL}`
    );
    await sendCardPaymentFailedEmail({
      to: contract.contact_email,
      storeName: store?.name ?? "店舗",
      amount: (last?.amount as number | null) ?? 0,
      suspendOn: jstDateLabel(suspendAt.toISOString()),
    }).catch(() => undefined);
  }
}

async function renewOwnBilledAddons(supabase: Supa, nowIso: string) {
  const out: Array<{ id: string; ok: boolean; detail?: string }> = [];
  const { data: rows } = await supabase
    .from("store_contract_addons")
    .select("id, fee, current_period_end, billing_anchor_day, addons(name), store_contracts!inner(id, store_id, status, cancel_at_period_end, fincode_customer_id, contact_email, stores(name))")
    .eq("billing_method", "card")
    .eq("fincode_subscription_id", "own_billing")
    .is("pending_removed_at", null)
    .not("current_period_end", "is", null)
    .lte("current_period_end", nowIso);

  for (const row of (rows ?? []) as any[]) {
    const contract = Array.isArray(row.store_contracts) ? row.store_contracts[0] : row.store_contracts;
    const addon = Array.isArray(row.addons) ? row.addons[0] : row.addons;
    if (!contract || contract.status !== "active" || contract.cancel_at_period_end || !contract.fincode_customer_id || String(contract.fincode_customer_id).startsWith("session:")) continue;
    const overdueDays = (Date.now() - Date.parse(row.current_period_end)) / 86400_000;
    // 金額が入っていない行は決済しない(0円決済・誤った金額の防止)
    if (!Number.isInteger(row.fee) || row.fee <= 0) {
      out.push({ id: row.id, ok: false, detail: `金額が不正のため決済しませんでした(fee=${row.fee})` });
      continue;
    }

    const charge = await chargeOnce({
      purpose: "addon_renewal",
      // 何の支払いか: 「このアドオンの、この期間からの更新」
      groupKey: periodGroupKey("addon_renewal", row.id, row.current_period_end),
      customerId: contract.fincode_customer_id,
      amount: row.fee,
      refs: { storeContractId: contract.id, storeContractAddonId: row.id, storeId: contract.store_id },
      context: { kind: "addon_renewal", storeContractAddonId: row.id },
      description: `アドオン更新（${addon?.name ?? "アドオン"}・契約 ${contract.id}）`,
    });
    if (charge.status === "BUSY" || charge.status === "UNKNOWN") {
      // 決済したか分からない: 失敗扱いにせず、運営の確認を待つ
      out.push({ id: row.id, ok: false, detail: `結果確認待ち(${charge.status}): ${charge.error}` });
      continue;
    }
    if (charge.status === "CAPTURED") {
      // 日本時間の暦日で、更新日を変えずに1か月延ばす(遅れて決済できた場合は決済日から1か月)
      const period = renewedPeriodEnd({ previousPeriodEndIso: row.current_period_end, anchorDay: row.billing_anchor_day ?? null, graceDays: CARD_GRACE_DAYS });
      const newEnd = new Date(period.periodEndIso);
      await supabase.from("store_contract_addons").update({ current_period_end: newEnd.toISOString(), billing_anchor_day: period.anchorDay }).eq("id", row.id);
      await supabase.from("billing_events").insert({
        store_contract_id: contract.id,
        event_type: "success",
        amount: charge.amount,
        source: "card_renewal",
        note: `アドオン更新の決済(${addon?.name ?? "アドオン"})`,
      });
      if (contract.contact_email) {
        const store = Array.isArray(contract.stores) ? contract.stores[0] : contract.stores;
        const d = new Date(newEnd.getTime() + 9 * 3600 * 1000);
        await sendPaymentReceiptEmail({
          to: contract.contact_email,
          storeName: store?.name ?? "店舗",
          amount: charge.amount,
          description: `アドオンの更新（${addon?.name ?? "アドオン"}）`,
          periodEnd: `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`,
          at: new Date(),
        }).catch(() => undefined);
      }
      {
        const d = new Date(newEnd.getTime() + 9 * 3600 * 1000);
        await notifyStoreLine(
          { storeId: contract.store_id },
          `${yen(charge.amount)}のカード決済が完了しました（アドオン更新：${addon?.name ?? "アドオン"}）。\n次回更新日：${d.getUTCMonth() + 1}月${d.getUTCDate()}日\n${PLAN_PAGE_URL}`
        );
      }
      out.push({ id: row.id, ok: true });
    } else {
      await supabase.from("billing_events").insert({
        store_contract_id: contract.id,
        event_type: "failed",
        amount: row.fee ?? 0,
        source: "card_renewal",
        note: `アドオン更新の決済失敗(${addon?.name ?? "アドオン"}): ${charge.error}`.slice(0, 500),
      });
      // 猶予日数を過ぎても決済できないアドオンは外す
      if (overdueDays >= CARD_GRACE_DAYS) {
        await supabase.from("store_contract_addons").delete().eq("id", row.id);
        await notifyStoreLine(
          { storeId: contract.store_id },
          `カード決済ができなかったため、アドオン「${addon?.name ?? "アドオン"}」を解除しました。\n${PLAN_PAGE_URL}`
        );
        out.push({ id: row.id, ok: false, detail: "決済できないため解除" });
      } else {
        out.push({ id: row.id, ok: false, detail: charge.error });
      }
    }
  }
  return out;
}

import { revalidatePublicData } from "@/lib/revalidate";
import {deliverMatchingNotifications} from "@/lib/matching-notification-delivery";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { applyContractBillingChange, isPaymentPendingError, CARD_GRACE_DAYS } from "@/lib/contracts-billing";
import { chargeOnce, periodGroupKey, reconcileStaleAttempts } from "@/lib/payment-ledger";
import { addMonthsAnchored, jstDateOf, jstMidnightIso, renewedPeriodEnd } from "@/lib/billing-dates";
import { finalizeDueCancellations } from "@/lib/contract-cancel";
import { startCronRun, finishCronRun, checkCronAlive, type CronFailure } from "@/lib/cron-run";
import { sendCardPaymentFailedEmail, sendPaymentReceiptEmail, sendPrepayRenewalNoticeEmail, sendTrialEndingEmail } from "@/lib/email";
import { alertAdmin } from "@/lib/admin-alert";
import { getBillingSettings, quote, discountFor } from "@/lib/bank-transfer";
import { effectivePlanFee } from "@/lib/price-lock";
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
        .select("id, store_id, plan_id, pending_plan_id, pending_plan_effective_at, status, cancel_at_period_end, billing_method, billing_cycle_months, current_period_end, contact_email, suspended_for_nonpayment_at, stores(name, status)")
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
          // 決済した日(日本時間)から1か月(まとめ払いは6・12か月)後の同じ日を次の更新日にする
          const paidDay = jstDateOf(recent.occurred_at as string);
          const cycle = [6, 12].includes(Number((contract as any).billing_cycle_months)) ? Number((contract as any).billing_cycle_months) : 1;
          const d = new Date(jstMidnightIso(addMonthsAnchored(paidDay, cycle)));
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
          // 同時に動いた別の実行が決済中だった場合は、少し待って、そちらで更新が済んだかを確かめる
          await new Promise((r) => setTimeout(r, 8000));
          const { data: after } = await supabase.from("store_contracts").select("current_period_end").eq("id", storeContractId).maybeSingle();
          if (isRenewal && after?.current_period_end && after.current_period_end > new Date().toISOString()) {
            results.push({ storeContractId, ok: true, detail: "同時に動いた別の実行で決済・更新済み(二重には決済していません)" });
          } else {
            results.push({ storeContractId, ok: false, detail: `結果確認待ち: ${chargeError.message}` });
          }
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

  // カードのまとめ払い(6か月・12か月)の自動更新の7日前に、店舗へお知らせする(2026/10/19、ユーザー指示)
  const notices = await sendPrepayRenewalNotices(supabase).catch((e) => {
    failures.push({ step: "まとめ払いの更新のお知らせ", detail: e instanceof Error ? e.message : String(e) });
    return [] as Array<{ id: string; ok: boolean; detail?: string }>;
  });
  for (const r of notices) if (!r.ok) failures.push({ step: "まとめ払いの更新のお知らせ", id: r.id, detail: r.detail ?? "" });

  // 無料期間(知り合いの店など)の終わる7日前のお知らせと、終わったのに続け方が決まっていない契約の運営への連絡(2026/10/20)
  const trialResults = await handleTrials(supabase).catch((e) => {
    failures.push({ step: "無料期間のお知らせ", detail: e instanceof Error ? e.message : String(e) });
    return [] as Array<{ id: string; ok: boolean; detail?: string }>;
  });
  for (const r of trialResults) if (!r.ok) failures.push({ step: "無料期間のお知らせ", id: r.id, detail: r.detail ?? "" });

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
    renewalNotices: notices.filter((r) => r.ok).length,
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
      if (charge.status === "BUSY") {
        // 同時に動いた別の実行が決済中: 少し待って、そちらで更新が済んだかを確かめる
        await new Promise((r) => setTimeout(r, 8000));
        const { data: after } = await supabase.from("store_contract_addons").select("current_period_end").eq("id", row.id).maybeSingle();
        if (after?.current_period_end && after.current_period_end > new Date().toISOString()) {
          out.push({ id: row.id, ok: true, detail: "同時に動いた別の実行で決済・更新済み(二重には決済していません)" });
          continue;
        }
      }
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


/** まとめ払いのカード契約で、更新日の7日前になったものに自動更新のお知らせを送る(期間ごとに1回) */
async function sendPrepayRenewalNotices(supabase: Supa) {
  const out: Array<{ id: string; ok: boolean; detail?: string }> = [];
  const now = Date.now();
  const until = new Date(now + 7 * 86400_000).toISOString();
  const { data: rows } = await supabase
    .from("store_contracts")
    .select("id, plan_id, billing_cycle_months, current_period_end, renewal_notice_for, contact_email, price_lock_plan_id, price_lock_fee, price_lock_ended_at, stores(name), plans!store_contracts_plan_id_fkey(name, monthly_fee)")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .eq("billing_method", "card")
    .in("billing_cycle_months", [6, 12])
    .gt("current_period_end", new Date(now).toISOString())
    .lte("current_period_end", until);
  if (!rows?.length) return out;
  const settings = await getBillingSettings(supabase);
  for (const c of rows as any[]) {
    if (c.renewal_notice_for && Date.parse(c.renewal_notice_for) === Date.parse(c.current_period_end)) continue;
    if (!c.contact_email) {
      out.push({ id: c.id, ok: false, detail: "連絡先メールが無いため、更新のお知らせを送れません" });
      continue;
    }
    try {
      const plan = Array.isArray(c.plans) ? c.plans[0] : c.plans;
      const store = Array.isArray(c.stores) ? c.stores[0] : c.stores;
      const months = Number(c.billing_cycle_months) as 6 | 12;
      const amount = quote(effectivePlanFee(c, c.plan_id, plan?.monthly_fee ?? 0), months, discountFor(settings, months)).total;
      const label = (iso: string) => {
        const d = new Date(Date.parse(iso) + 9 * 3600 * 1000);
        return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
      };
      await sendPrepayRenewalNoticeEmail({
        to: c.contact_email,
        storeName: store?.name ?? "店舗",
        planName: plan?.name ?? "ご契約プラン",
        months,
        amount,
        renewOn: label(c.current_period_end),
        deadline: label(new Date(Date.parse(c.current_period_end) - 86400_000).toISOString()),
      });
      await supabase.from("store_contracts").update({ renewal_notice_for: c.current_period_end }).eq("id", c.id);
      out.push({ id: c.id, ok: true });
    } catch (e) {
      out.push({ id: c.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}


/**
 * 無料期間の契約(trial_ends_at あり)の自動のお知らせ(2026/10/20)。
 *  - 終わる7日前: 店舗へ「続けるならカード登録を」のメール・LINE、運営へもメール(1回だけ)
 *  - 終わった日以降: カード未登録・振込でもない(続け方が決まっていない)契約を運営へメール(1回だけ)。
 *    決まるまでは無料のまま使える。カード登録済みの契約は、通常の自動更新で決済される。
 */
async function handleTrials(supabase: Supa) {
  const out: Array<{ id: string; ok: boolean; detail?: string }> = [];
  const now = Date.now();
  const { data: rows } = await supabase
    .from("store_contracts")
    .select("id, store_id, trial_ends_at, trial_notice_sent_at, trial_end_notified_at, billing_method, fincode_customer_id, contact_email, stores(name), plans!store_contracts_plan_id_fkey(name, monthly_fee)")
    .eq("status", "active")
    .not("trial_ends_at", "is", null);
  const label = (iso: string) => {
    const d = new Date(Date.parse(iso) - 1 + 9 * 3600 * 1000);
    return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  };
  for (const c of (rows ?? []) as any[]) {
    try {
      const store = Array.isArray(c.stores) ? c.stores[0] : c.stores;
      const plan = Array.isArray(c.plans) ? c.plans[0] : c.plans;
      const hasCard = !!c.fincode_customer_id && !String(c.fincode_customer_id).startsWith("session:");
      const decided = hasCard || c.billing_method === "bank_transfer";
      const endsAt = Date.parse(c.trial_ends_at);
      const link = `/admin/contracts/${c.id}`;
      if (!c.trial_notice_sent_at && endsAt > now && endsAt - now <= 7 * 86400_000) {
        if (!decided && c.contact_email) {
          await sendTrialEndingEmail({ to: c.contact_email, storeName: store?.name ?? "店舗", planName: plan?.name ?? "ご契約プラン", endOn: label(c.trial_ends_at), monthlyFee: plan?.monthly_fee ?? 0 });
        }
        if (!decided) {
          await notifyStoreLine({ storeId: c.store_id }, `${plan?.name ?? "ご契約プラン"}の無料期間は${label(c.trial_ends_at)}までです。引き続きご利用いただく場合は、プラン・お支払いからカードをご登録ください（振込をご希望の場合は運営までご連絡ください）。\n${PLAN_PAGE_URL}`);
        }
        await alertAdmin(`無料期間がもうすぐ終わります（${store?.name ?? "店舗"}）`, [
          `${store?.name ?? "店舗"}（${plan?.name ?? "プラン"}）の無料期間は${label(c.trial_ends_at)}までです。`,
          decided ? (hasCard ? "店舗はカード登録済みです。終わった日に自動で決済して続きます。" : "振込で続けます。請求書は自動で発行します。") : "まだ続け方が決まっていません。契約の画面で「振込で続ける」か「終了する」を選べます（店舗がカードを登録すれば自動で続きます）。",
          !c.contact_email ? "※請求先メールアドレスが未登録のため、店舗へのメールは送れていません。" : "",
        ].filter(Boolean), link);
        await supabase.from("store_contracts").update({ trial_notice_sent_at: new Date().toISOString() }).eq("id", c.id);
        out.push({ id: c.id, ok: true });
      }
      if (!decided && !c.trial_end_notified_at && endsAt <= now) {
        await alertAdmin(`無料期間が終わりました。続けるか決めてください（${store?.name ?? "店舗"}）`, [
          `${store?.name ?? "店舗"}（${plan?.name ?? "プラン"}）の無料期間が${label(c.trial_ends_at)}で終わりました。`,
          "カードの登録も振込への切り替えもまだです。契約の画面で「振込で続ける」か「終了する（無料掲載に戻す）」を選んでください。",
          "決まるまでは無料のまま使えます。店舗がカードを登録すれば、その場で決済して続きます。",
        ], link);
        await supabase.from("store_contracts").update({ trial_end_notified_at: new Date().toISOString() }).eq("id", c.id);
        out.push({ id: c.id, ok: true });
      }
    } catch (e) {
      out.push({ id: c.id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

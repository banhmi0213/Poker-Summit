import {deliverMatchingNotifications} from "@/lib/matching-notification-delivery";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { applyContractBillingChange } from "@/lib/contracts-billing";
import { chargeSavedCard, newOrderId } from "@/lib/komoju";
import { sendCardPaymentFailedEmail } from "@/lib/email";

// カード払いの決済に失敗してから、掲載を止めるまでの猶予日数
const CARD_GRACE_DAYS = 7;

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

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Retry the durable notification outbox without interfering with billing.
  await deliverMatchingNotifications().catch(()=>undefined);
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  // 対象1: プランのダウングレード予約が適用日時を過ぎている契約。
  const { data: duePlanContracts, error: planError } = await supabase
    .from("store_contracts")
    .select("id")
    .eq("status", "active")
    .not("pending_plan_id", "is", null)
    .lte("pending_plan_effective_at", nowIso);
  if (planError) {
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
    return NextResponse.json({ error: addonError.message }, { status: 500 });
  }

  // カード払い契約の自動更新: 契約期間が終わったものは、今の構成(プラン+カード払いの月額アドオン)で決済する
  const { data: dueRenewals, error: renewalError } = await supabase
    .from("store_contracts")
    .select("id")
    .eq("status", "active")
    .or("billing_method.is.null,billing_method.eq.card")
    .not("fincode_customer_id", "is", null)
    .not("fincode_customer_id", "like", "session:%")
    .lte("current_period_end", nowIso);
  if (renewalError) {
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
        .select("id, store_id, plan_id, pending_plan_id, pending_plan_effective_at, status, billing_method, current_period_end, contact_email, suspended_for_nonpayment_at, stores(name, status)")
        .eq("id", storeContractId)
        .single();
      if (contractFetchError || !contract) throw new Error(contractFetchError?.message ?? "契約が見つかりません。");
      if (contract.status !== "active") continue;
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
        // 決済できなかった: 毎日再試行し、猶予日数を過ぎたら掲載を止める(決済できた時点で再開)
        if (isRenewal) await handleRenewalFailure(supabase, contract as any);
        throw chargeError;
      }
    } catch (e) {
      results.push({ storeContractId, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  // アドオン単独で毎月カード決済している行(fincode_subscription_id = own_billing)の更新
  const addonResults = await renewOwnBilledAddons(supabase, nowIso);

  return NextResponse.json({ processed: results.length, results, addonResults });
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
    .select("id, fee, current_period_end, addons(name), store_contracts!inner(id, status, fincode_customer_id)")
    .eq("billing_method", "card")
    .eq("fincode_subscription_id", "own_billing")
    .is("pending_removed_at", null)
    .not("current_period_end", "is", null)
    .lte("current_period_end", nowIso);

  for (const row of (rows ?? []) as any[]) {
    const contract = Array.isArray(row.store_contracts) ? row.store_contracts[0] : row.store_contracts;
    const addon = Array.isArray(row.addons) ? row.addons[0] : row.addons;
    if (!contract || contract.status !== "active" || !contract.fincode_customer_id || String(contract.fincode_customer_id).startsWith("session:")) continue;
    const overdueDays = (Date.now() - Date.parse(row.current_period_end)) / 86400_000;

    const charge = await chargeSavedCard({
      orderId: newOrderId("ar", row.id),
      customerId: contract.fincode_customer_id,
      amount: row.fee ?? 0,
      metadata: { store_contract_id: contract.id, store_contract_addon_id: row.id },
    });
    if (charge.status === "CAPTURED") {
      const next = new Date(Date.parse(row.current_period_end));
      next.setUTCMonth(next.getUTCMonth() + 1);
      // 遅れて決済できた場合は、決済日から1か月にする
      const newEnd = next.getTime() > Date.now() ? next : new Date(Date.now() + 30 * 86400_000);
      await supabase.from("store_contract_addons").update({ current_period_end: newEnd.toISOString() }).eq("id", row.id);
      await supabase.from("billing_events").insert({
        store_contract_id: contract.id,
        event_type: "success",
        amount: row.fee ?? 0,
        source: "card_renewal",
        note: `アドオン更新の決済(${addon?.name ?? "アドオン"})`,
      });
      out.push({ id: row.id, ok: true });
    } else {
      await supabase.from("billing_events").insert({
        store_contract_id: contract.id,
        event_type: "failed",
        amount: row.fee ?? 0,
        source: "card_renewal",
        note: `アドオン更新の決済失敗(${addon?.name ?? "アドオン"}): ${charge.status} ${charge.error_code ?? ""}`.slice(0, 500),
      });
      // 猶予日数を過ぎても決済できないアドオンは外す
      if (overdueDays >= CARD_GRACE_DAYS) {
        await supabase.from("store_contract_addons").delete().eq("id", row.id);
        out.push({ id: row.id, ok: false, detail: "決済できないため解除" });
      } else {
        out.push({ id: row.id, ok: false, detail: charge.error_code ?? charge.status });
      }
    }
  }
  return out;
}

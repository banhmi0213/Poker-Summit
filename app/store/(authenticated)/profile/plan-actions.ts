"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { applyContractBillingChange, schedulePlanDowngrade, cancelScheduledPlanChange } from "@/lib/contracts-billing";
import { pickupSlotsLeft } from "@/lib/plan-entitlements";

// ============================================================================
// 店舗オーナーが自分でプランを変更する(2026/10、カード決済組み込み・
// 決済完了後に即時反映する方式に変更)。
//
// - 金額が上がる(または同額の)変更: その場でカード決済を実行し、成功した
//   瞬間にstore_contracts.plan_idを切り替える(日割りなし、満額課金)。
// - 金額が下がる変更: 即座には切り替えず、現在の契約期間
//   (current_period_end)が終わるタイミングで適用されるよう予約するだけ
//   (課金なし。実際の適用・再課金はcronジョブが担当)。
//
// plan_change_requestsは、以前は「運営の承認待ちキュー」だったが、
// 運営の手動承認を挟まなくなったため、今は「店舗が行った変更の監査ログ・
// 予約状態の記録」として使う(status: pending=予約中 / completed=即時
// 反映済み / failed=決済失敗 / canceled=予約取消)。
// ============================================================================

export async function requestPlanChange(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const requestedPlanId = String(formData.get("requestedPlanId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!storeId || !requestedPlanId) {
    throw new Error("店舗またはプランが指定されていません。");
  }

  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("store_contracts")
    .select("id, plan_id, billing_method, plans!store_contracts_plan_id_fkey(monthly_fee, pickup), store_contract_addons(addon_id)")
    .eq("store_id", storeId)
    .maybeSingle();

  if (!contract) {
    throw new Error("この店舗にはまだ契約が登録されていません。運営にお問い合わせください。");
  }
  if ((contract as { billing_method?: string }).billing_method === "bank_transfer") {
    throw new Error("銀行振込でご契約中のため、プランの変更はお問い合わせフォームからご連絡ください。");
  }

  const { data: requestedPlan } = await supabase
    .from("plans")
    .select("id, monthly_fee, pickup")
    .eq("id", requestedPlanId)
    .maybeSingle();
  if (!requestedPlan) throw new Error("プランが見つかりません。");

  // プレミアムプラン(PICK UP表示付き)は各都道府県10店舗まで。決済の前に空きを確認する。
  const currentHasPickup = !!(contract.plans as { pickup?: boolean } | null)?.pickup;
  if (requestedPlan.pickup && !currentHasPickup) {
    const { data: store } = await supabase.from("stores").select("pref").eq("id", storeId).maybeSingle();
    if ((await pickupSlotsLeft(supabase, store?.pref ?? null, storeId)) <= 0) {
      throw new Error(`${store?.pref ?? "この地域"}のプレミアムプラン（PICK UP枠・10店舗限定）は現在満枠です。空きが出るまでお待ちください。`);
    }
  }

  const currentFee = (contract.plans as { monthly_fee: number } | null)?.monthly_fee ?? 0;
  const currentAddonIds = ((contract.store_contract_addons ?? []) as { addon_id: string }[]).map(
    (a) => a.addon_id
  );

  // 新しく予約/確定するこの変更と矛盾する、古い「予約中」レコードは
  // 先に消しておく(以前の「既存pendingがあれば更新」方式から、
  // 常に最新の状態だけを残すdelete→insert方式に変更)。
  await supabase.from("plan_change_requests").delete().eq("store_id", storeId).eq("status", "pending");

  const isUpgradeOrSame = (requestedPlan.monthly_fee ?? 0) >= currentFee;

  if (isUpgradeOrSame) {
    try {
      const result = await applyContractBillingChange({
        storeContractId: contract.id,
        newPlanId: requestedPlanId,
        newAddonIds: currentAddonIds,
        resolvesPendingPlan: true,
      });
      await supabase.from("plan_change_requests").insert({
        store_id: storeId,
        store_contract_id: contract.id,
        current_plan_id: contract.plan_id,
        requested_plan_id: requestedPlanId,
        note: note || null,
        status: "completed",
        payment_status: "charged",
        charged_amount: result.chargedAmount,
        reviewed_at: new Date().toISOString(),
      });
    } catch (e) {
      await supabase.from("plan_change_requests").insert({
        store_id: storeId,
        store_contract_id: contract.id,
        current_plan_id: contract.plan_id,
        requested_plan_id: requestedPlanId,
        note: note || null,
        status: "failed",
        payment_status: "failed",
        review_note: e instanceof Error ? e.message : String(e),
        reviewed_at: new Date().toISOString(),
      });
      throw e;
    }
  } else {
    await schedulePlanDowngrade({ storeContractId: contract.id, newPlanId: requestedPlanId });
    await supabase.from("plan_change_requests").insert({
      store_id: storeId,
      store_contract_id: contract.id,
      current_plan_id: contract.plan_id,
      requested_plan_id: requestedPlanId,
      note: note || null,
      status: "pending",
      payment_status: "scheduled",
    });
  }

  revalidatePath("/store/profile/plan");
}

export async function cancelPlanChangeRequest(requestId: string) {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("plan_change_requests")
    .select("id, store_contract_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw new Error("申請が見つかりません。");
  if (request.status !== "pending") throw new Error("この予約はすでに処理済みです。");

  if (request.store_contract_id) {
    await cancelScheduledPlanChange(request.store_contract_id);
  }

  const { error } = await supabase
    .from("plan_change_requests")
    .delete()
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  revalidatePath("/store/profile/plan");
}

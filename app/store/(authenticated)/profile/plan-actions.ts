"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { applyContractBillingChange, schedulePlanDowngrade, cancelScheduledPlanChange } from "@/lib/contracts-billing";
import { pickupSlotsLeft } from "@/lib/plan-entitlements";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendPlanChangeEmail } from "@/lib/email";

function jpDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(Date.parse(iso) + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

// プラン変更の確認メール(ベストエフォート。送れなくても変更自体は止めない)。
async function notifyPlanChange(params: {
  contractId: string;
  fromPlanId: string | null;
  toPlanId: string;
  kind: "changed" | "scheduled" | "failed";
  amount?: number | null;
  reason?: string | null;
}) {
  try {
    const svc = createServiceRoleClient();
    const [{ data: contract }, { data: plans }] = await Promise.all([
      svc
        .from("store_contracts")
        .select("contact_email, current_period_end, pending_plan_effective_at, stores(name)")
        .eq("id", params.contractId)
        .maybeSingle(),
      svc.from("plans").select("id, name").in("id", [params.fromPlanId, params.toPlanId].filter(Boolean) as string[]),
    ]);
    const to = contract?.contact_email as string | null | undefined;
    if (!to) return;
    const nameOf = (id: string | null) => (plans ?? []).find((p) => p.id === id)?.name ?? "（未設定）";
    const store = (Array.isArray(contract?.stores) ? contract?.stores[0] : contract?.stores) as { name?: string } | null;
    await sendPlanChangeEmail({
      to,
      storeName: store?.name ?? "店舗",
      kind: params.kind,
      fromPlan: nameOf(params.fromPlanId),
      toPlan: nameOf(params.toPlanId),
      amount: params.amount ?? null,
      periodEnd: jpDate(contract?.current_period_end as string | null),
      effectiveDate: jpDate((contract?.pending_plan_effective_at ?? contract?.current_period_end) as string | null),
      reason: params.reason ?? null,
    });
  } catch (e) {
    console.error("plan change email failed", e);
  }
}

// server action の例外は Next.js の「Application error」画面になってしまうため、
// ここで受け止めて、結果をページ上部のメッセージとして表示する(?ok= / ?error=)。
function backToPlan(kind: "ok" | "error", message: string): never {
  redirect(`/store/profile/plan?${kind}=${encodeURIComponent(message)}`);
}

async function settle(run: () => Promise<string>) {
  let message = "";
  let failed = false;
  try {
    message = await run();
  } catch (e) {
    failed = true;
    message = e instanceof Error ? e.message : String(e);
  }
  revalidatePath("/store/profile/plan");
  backToPlan(failed ? "error" : "ok", message || "変更を受け付けました。");
}

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

async function requestPlanChangeImpl(formData: FormData): Promise<string> {
  const storeId = String(formData.get("storeId") ?? "");
  const requestedPlanId = String(formData.get("requestedPlanId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!storeId || !requestedPlanId) {
    throw new Error("店舗またはプランが指定されていません。");
  }

  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("store_contracts")
    .select("id, plan_id, billing_method, plans!store_contracts_plan_id_fkey(monthly_fee, pickup), store_contract_addons(addon_id, billing_method, fincode_subscription_id)")
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
  if (requestedPlan.id === contract.plan_id) {
    return "すでにこのプランでご契約中です。";
  }

  // プレミアムプラン(PICK UP表示付き)は各都道府県10店舗まで。決済の前に空きを確認する。
  const currentHasPickup = !!(contract.plans as { pickup?: boolean } | null)?.pickup;
  if (requestedPlan.pickup && !currentHasPickup) {
    const { data: store } = await supabase.from("stores").select("pref").eq("id", storeId).maybeSingle();
    if ((await pickupSlotsLeft(supabase, store?.pref ?? null, storeId)) <= 0) {
      throw new Error(`${store?.pref ?? "この地域"}のプレミアムプラン（PICK UP枠・10店舗限定）は現在満枠です。空きが出るまでお待ちください。`);
    }
  }

  const currentFee = (contract.plans as { monthly_fee: number } | null)?.monthly_fee ?? 0;
  // カードで払っている月額アドオンだけ(振込のアドオンは別の請求書で払う)
  // プランのサブスクにまとめて払っている(古い方式の)アドオンだけ。アドオン別のサブスク・振込のものは対象外
  const currentAddonIds = ((contract.store_contract_addons ?? []) as { addon_id: string; billing_method?: string; fincode_subscription_id?: string | null }[])
    .filter((a) => (a.billing_method ?? "card") === "card" && !a.fincode_subscription_id)
    .map((a) => a.addon_id);

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
      await notifyPlanChange({
        contractId: contract.id,
        fromPlanId: contract.plan_id,
        toPlanId: requestedPlanId,
        kind: "changed",
        amount: result.chargedAmount,
      });
      revalidatePath("/store/profile/plan");
      return `プランを変更しました（${(result.chargedAmount ?? 0).toLocaleString("ja-JP")}円を決済しました）。`;
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
      await notifyPlanChange({
        contractId: contract.id,
        fromPlanId: contract.plan_id,
        toPlanId: requestedPlanId,
        kind: "failed",
        reason: e instanceof Error ? e.message : String(e),
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
    await notifyPlanChange({
      contractId: contract.id,
      fromPlanId: contract.plan_id,
      toPlanId: requestedPlanId,
      kind: "scheduled",
    });
    return "プランの変更を予約しました。現在の契約期間が終わるタイミングで切り替わります。";
  }

  return "";
}

async function cancelPlanChangeRequestImpl(requestId: string): Promise<string> {
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

  return "";
}

export async function requestPlanChange(formData: FormData) {
  await settle(() => requestPlanChangeImpl(formData));
}

export async function cancelPlanChangeRequest(requestId: string) {
  await settle(() => cancelPlanChangeRequestImpl(requestId));
}

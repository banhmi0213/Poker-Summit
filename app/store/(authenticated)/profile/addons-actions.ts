"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import {
  applyContractBillingChange,
  scheduleAddonRemovals,
  cancelScheduledAddonRemovals,
} from "@/lib/contracts-billing";

// ============================================================================
// 店舗オーナーが自分でアドオン構成を変更する(2026/10、カード決済組み込み・
// 決済完了後に即時反映する方式に変更)。plan-actions.tsと同じ方針:
//
// - 追加がある変更: 新しい構成(プラン+全アクティブアドオン)の合計金額を
//   その場で決済し、成功した瞬間に反映する。
// - 解除のみの変更: 今すぐには外さず、現在の契約期間が終わるタイミングで
//   外れるよう予約するだけ(課金なし)。
//
// addon_change_requestsは「店舗が行った変更の監査ログ・予約状態の記録」
// として使う(status: pending=予約中 / completed=即時反映済み /
// failed=決済失敗 / canceled=予約取消)。
// ============================================================================

export async function requestAddonChange(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const addonIds = formData.getAll("addonIds").map(String).filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();

  if (!storeId) {
    throw new Error("店舗が指定されていません。");
  }

  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("store_contracts")
    .select("id, plan_id, store_contract_addons(addon_id)")
    .eq("store_id", storeId)
    .maybeSingle();

  if (!contract) {
    throw new Error("この店舗にはまだ契約が登録されていません。運営にお問い合わせください。");
  }
  if (!contract.plan_id) {
    throw new Error("この店舗にはプランが設定されていません。運営にお問い合わせください。");
  }

  const currentAddonIds = ((contract.store_contract_addons ?? []) as { addon_id: string }[]).map(
    (a) => a.addon_id
  );
  const currentSet = new Set(currentAddonIds);
  const desiredSet = new Set(addonIds);
  const toAdd = addonIds.filter((id) => !currentSet.has(id));
  const toRemove = currentAddonIds.filter((id) => !desiredSet.has(id));

  // 新しく予約/確定するこの変更と矛盾する、古い「予約中」レコードは
  // 先に消しておく。
  await supabase.from("addon_change_requests").delete().eq("store_id", storeId).eq("status", "pending");

  if (toAdd.length === 0 && toRemove.length === 0) {
    // 変更なし。
    revalidatePath("/store/profile/plan");
    return;
  }

  if (toAdd.length > 0) {
    // 追加があれば、新しい構成全体の合計金額で即時決済・即時反映する
    // (解除予定だったアドオンの予約も、この全置き換えでクリアされる)。
    try {
      const result = await applyContractBillingChange({
        storeContractId: contract.id,
        newPlanId: contract.plan_id,
        newAddonIds: addonIds,
        resolvesPendingPlan: false,
      });
      await supabase.from("addon_change_requests").insert({
        store_id: storeId,
        store_contract_id: contract.id,
        requested_addon_ids: addonIds,
        note: note || null,
        status: "completed",
        payment_status: "charged",
        charged_amount: result.chargedAmount,
        reviewed_at: new Date().toISOString(),
      });
    } catch (e) {
      await supabase.from("addon_change_requests").insert({
        store_id: storeId,
        store_contract_id: contract.id,
        requested_addon_ids: addonIds,
        note: note || null,
        status: "failed",
        payment_status: "failed",
        review_note: e instanceof Error ? e.message : String(e),
        reviewed_at: new Date().toISOString(),
      });
      throw e;
    }
  } else {
    // 解除のみ: 今すぐは外さず、現在の契約期間が終わるタイミングで
    // 外れるよう予約するだけ(課金なし)。
    await scheduleAddonRemovals({ storeContractId: contract.id, addonIdsToRemove: toRemove });
    await supabase.from("addon_change_requests").insert({
      store_id: storeId,
      store_contract_id: contract.id,
      requested_addon_ids: addonIds,
      note: note || null,
      status: "pending",
      payment_status: "scheduled",
    });
  }

  revalidatePath("/store/profile/plan");
}

export async function cancelAddonChangeRequest(requestId: string) {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("addon_change_requests")
    .select("id, store_contract_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw new Error("申請が見つかりません。");
  if (request.status !== "pending") throw new Error("この予約はすでに処理済みです。");

  if (request.store_contract_id) {
    await cancelScheduledAddonRemovals(request.store_contract_id);
  }

  const { error } = await supabase
    .from("addon_change_requests")
    .delete()
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  revalidatePath("/store/profile/plan");
}

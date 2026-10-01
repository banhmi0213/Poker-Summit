"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";

// プラン変更申請(plan-actions.ts)と同じパターン。店舗オーナーは
// fincode決済やstore_contract_addonsを直接叩けないため、「このアドオン
// 構成にしたい」という申請をaddon_change_requestsに記録し、運営が
// /admin/contractsから内容を確認して確定させる運用にする
// (2026/10、「店舗がアドオン申請できるようにせなあかん」との指示)。
// プランは単一選択だが、アドオンは複数持てるため、希望するアドオンの
// 組み合わせを丸ごと(requested_addon_ids配列)1件の申請として記録する
// (admin側のreplaceContractAddonsと同じ「全体を置き換える」考え方)。
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
    .select("id")
    .eq("store_id", storeId)
    .maybeSingle();

  // 同じ店舗の「審査待ち」申請が既にあれば、二重申請せず更新するだけに
  // する(plan-actionsと同じ、オーナーが希望を変更して送り直した場合の
  // 取り違え防止)。
  const { data: existing } = await supabase
    .from("addon_change_requests")
    .select("id")
    .eq("store_id", storeId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("addon_change_requests")
      .update({
        requested_addon_ids: addonIds,
        store_contract_id: contract?.id ?? null,
        note: note || null,
        requested_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("addon_change_requests").insert({
      store_id: storeId,
      store_contract_id: contract?.id ?? null,
      requested_addon_ids: addonIds,
      note: note || null,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/store/profile/plan");
}

export async function cancelAddonChangeRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("addon_change_requests")
    .delete()
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/store/profile/plan");
}

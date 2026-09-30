import { JOBS_ADDON_ID } from "@/lib/constants";

// 店舗の有効な契約(store_contracts, status='active')が、指定した
// アドオン(addon_id)を含んでいるかを調べる。求人機能を「アドオン契約が
// ないと触れない」ようにするために新設(2026/09/30)。
//
// 店舗オーナー用クライアント(RLS: 自分の契約のみ閲覧可)・管理者用クライ
// アントのどちらから呼んでも動くよう、supabaseクライアントを引数で受け取る
// 汎用の実装にしている。
export async function storeHasAddon(
  supabase: any,
  storeId: string,
  addonId: string
): Promise<boolean> {
  const { data: contract } = await supabase
    .from("store_contracts")
    .select("id, store_contract_addons(addon_id)")
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();

  if (!contract) return false;

  const addonIds: string[] = (contract.store_contract_addons ?? []).map(
    (a: { addon_id: string }) => a.addon_id
  );
  return addonIds.includes(addonId);
}

export async function storeHasJobsAddon(supabase: any, storeId: string): Promise<boolean> {
  return storeHasAddon(supabase, storeId, JOBS_ADDON_ID);
}

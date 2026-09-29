import type { SupabaseClient } from "@supabase/supabase-js";
import { PREF_OPTIONS } from "@/lib/constants";

export const PICKUP_PER_PREF_LIMIT = 10;

// "今月、引き落としに失敗している" の判定。billing_events の生ログではなく
// store_contracts に持たせた最新ステータスのスナップショット
// (last_billing_status / last_billing_at) を見る — 一覧を出すたびに全契約の
// billing_events を集計しなくて済むようにするための非正規化で、詳細な履歴は
// billing_events 側にそのまま残る。
export function isBillingFailedThisMonth(contract: {
  last_billing_status: string;
  last_billing_at: string | null;
}): boolean {
  if (contract.last_billing_status !== "failed" || !contract.last_billing_at) {
    return false;
  }
  const now = new Date();
  const lastAt = new Date(contract.last_billing_at);
  return lastAt.getFullYear() === now.getFullYear() && lastAt.getMonth() === now.getMonth();
}

// 47都道府県それぞれの PICK UP 埋まり具合(is_recommended=true な掲載中店舗の数)。
// 件数自体は少ない想定なので、都道府県ごとに47回問い合わせるのではなく
// pref 列だけ一括取得してJS側で集計する。
export async function getPickupOccupancyByPref(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const occupancy: Record<string, number> = {};
  for (const pref of PREF_OPTIONS) occupancy[pref] = 0;

  const { data, error } = await supabase
    .from("stores")
    .select("pref")
    .eq("is_recommended", true)
    .in("status", ["approved", "listed"]);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (row.pref && row.pref in occupancy) {
      occupancy[row.pref] += 1;
    }
  }

  return occupancy;
}

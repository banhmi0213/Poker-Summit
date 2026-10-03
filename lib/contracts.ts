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


function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 都道府県ごとのPICK UP表示順(2026/10、「PICKUPが埋まってない場合はランダム
// で出す、契約で埋まった場合は10店舗をランダムに上位表示、一部だけ埋まって
// る場合は契約店舗を優先的に上位表示して残り枠をランダム入れ替え」との指示
// を受けて実装)。
//
// - 契約店舗(is_recommended=true)は必ず全件含め、並び順はアクセスのたびに
//   シャッフルする(同じ店舗がいつも1位固定になるのを防ぐ)。
// - 残り枠(limit - 契約数)は、同じ都道府県の非契約・承認済み店舗からランダム
//   に抽選して埋める。リクエストのたびに選び直すので、非契約枠は自然に
//   ローテーションする。
// この1本のロジックで3パターンすべてをカバーする: 契約0件なら実質ランダムの
// 店舗だけがlimit件、契約がlimit件に達していればその契約店舗だけがシャッフル
// されて並ぶ、契約が一部だけなら契約店舗が優先(先頭)でその後ろがランダム。
export async function getPrefPickupStores(
  supabase: SupabaseClient,
  pref: string,
  limit: number = PICKUP_PER_PREF_LIMIT
): Promise<any[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .in("status", ["approved", "listed"])
    .eq("pref", pref);

  if (error) {
    throw new Error(error.message);
  }

  const all = data ?? [];
  const contracted = shuffle(all.filter((s: any) => s.is_recommended));
  const others = shuffle(all.filter((s: any) => !s.is_recommended));

  return [...contracted, ...others].slice(0, limit);
}

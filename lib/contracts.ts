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

// ---------------------------------------------------------------------------
// PICK UP店舗の表示(2026/10)
//
// 全国PICK UP(TOPページ・「すべての店舗を見る」): 全国10枠。
//  - 全国TOPページPICKUP(アドオン)の契約店舗は必ず表示(先頭。並びはアクセスごとにシャッフル)
//  - 足りない枠は、PICK UP契約のない店舗から抽選して埋める。抽選は月ごと(日本時間の月初めに
//    入れ替わり、その月の間は同じ店舗)。契約が増えると抽選店舗が後ろから押し出される。
// 地域PICK UP: その都道府県の地域PICKUP(アドオン)契約店舗を必ず表示し、足りない枠は
//  その都道府県のPICK UP契約のない店舗から月ごとの抽選で埋める(全国と同じ考え方)。
// ---------------------------------------------------------------------------
export const NATIONAL_PICKUP_SLOTS = 10;

function jstMonthKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

// 月+店舗IDから決まる抽選順(保存不要で、その月の間は同じ順番になる)
function lotteryScore(month: string, id: string) {
  let h = 2166136261;
  const key = `${month}:${id}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function getNationalPickupStores(supabase: SupabaseClient, limit: number = NATIONAL_PICKUP_SLOTS): Promise<any[]> {
  const { data, error } = await supabase.from("stores").select("*").in("status", ["approved", "listed"]);
  if (error) throw new Error(error.message);
  const all = data ?? [];
  const contracted = shuffle(all.filter((s: any) => s.is_national_pickup));
  const month = jstMonthKey();
  const drawn = all
    .filter((s: any) => !s.is_national_pickup && !s.is_recommended)
    .sort((a: any, b: any) => lotteryScore(month, a.id) - lotteryScore(month, b.id));
  return [...contracted, ...drawn].slice(0, Math.max(limit, contracted.length));
}

export const REGIONAL_PICKUP_SLOTS = 10;

/** 地域PICK UP: その都道府県の地域PICKUP契約店舗を必ず表示し、足りない枠は同じ都道府県の
 *  PICK UP契約のない店舗から月ごとの抽選で埋める(契約が増えると抽選店舗と入れ替わる)。 */
export async function getRegionalPickupStores(
  supabase: SupabaseClient,
  pref: string | null,
  limit: number = REGIONAL_PICKUP_SLOTS
): Promise<any[]> {
  if (!pref) return [];
  const { data, error } = await supabase.from("stores").select("*").in("status", ["approved", "listed"]).eq("pref", pref);
  if (error) throw new Error(error.message);
  const all = data ?? [];
  const contracted = shuffle(all.filter((s: any) => s.is_recommended));
  const month = jstMonthKey();
  const drawn = all
    .filter((s: any) => !s.is_recommended && !s.is_national_pickup)
    .sort((a: any, b: any) => lotteryScore(`${month}:${pref}`, a.id) - lotteryScore(`${month}:${pref}`, b.id));
  return [...contracted, ...drawn].slice(0, Math.max(limit, contracted.length));
}

/** 旧API(互換): 全国PICK UPを返す */
export async function getPrefPickupStores(supabase: SupabaseClient, _pref: string | null, limit: number = PICKUP_PER_PREF_LIMIT) {
  return getNationalPickupStores(supabase, limit);
}

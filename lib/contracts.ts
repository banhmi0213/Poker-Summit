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

/** 指定したidの店舗を全列で取り、idの順番どおりに並べて返す */
async function fetchFullStoresInOrder(supabase: SupabaseClient, ids: string[]): Promise<any[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("stores").select("*").in("id", ids).in("status", ["approved", "listed"]);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((s: any) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * PICK UPの候補。契約店舗(毎回ランダムに並べ替える)と、契約のない店舗から月ごとの抽選で
 * 決まる順番の店舗に分けて返す。抽選の結果は月の中で変わらないのでキャッシュしてよいが、
 * 契約店舗の並べ替えは表示のたびに assemblePickup で行うこと(2026/10)。
 */
export type PickupPool = { contracted: any[]; drawn: any[]; limit: number };

export async function getPickupPool(supabase: SupabaseClient, pref: string | null, limit?: number): Promise<PickupPool> {
  const national = !pref;
  const slots = limit ?? (national ? NATIONAL_PICKUP_SLOTS : REGIONAL_PICKUP_SLOTS);
  // 抽選には全店舗のidと契約フラグだけあれば足りるので、まず軽い列だけ取り、
  // 表示しうる店舗の分だけ全列を取り直す(全店舗の全列を毎回読むと重いため)
  let query = supabase.from("stores").select("id, is_national_pickup, is_recommended").in("status", ["approved", "listed"]);
  if (pref) query = query.eq("pref", pref);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const all = data ?? [];
  const month = jstMonthKey();
  const seed = national ? month : `${month}:${pref}`;
  const contractedIds = all.filter((s: any) => (national ? s.is_national_pickup : s.is_recommended)).map((s: any) => s.id);
  const drawnIds = all
    .filter((s: any) => !s.is_national_pickup && !s.is_recommended)
    .sort((a: any, b: any) => lotteryScore(seed, a.id) - lotteryScore(seed, b.id))
    .slice(0, slots)
    .map((s: any) => s.id);
  const [contracted, drawn] = await Promise.all([
    fetchFullStoresInOrder(supabase, contractedIds),
    fetchFullStoresInOrder(supabase, drawnIds),
  ]);
  return { contracted, drawn, limit: slots };
}

/**
 * 表示のたびに並び順だけをランダムにする(顔ぶれは月ごとの抽選のまま、2026/10)。
 * 契約店舗は必ず先頭側に出すため、契約店舗どうし・抽選店舗どうしでそれぞれ並べ替える。
 */
export function assemblePickup(pool: PickupPool): any[] {
  const contracted = shuffle(pool.contracted);
  const slots = Math.max(pool.limit, contracted.length);
  const drawn = shuffle(pool.drawn.slice(0, Math.max(0, slots - contracted.length)));
  return [...contracted, ...drawn];
}

export async function getNationalPickupStores(supabase: SupabaseClient, limit: number = NATIONAL_PICKUP_SLOTS): Promise<any[]> {
  return assemblePickup(await getPickupPool(supabase, null, limit));
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
  return assemblePickup(await getPickupPool(supabase, pref, limit));
}

/** 旧API(互換): 全国PICK UPを返す */
export async function getPrefPickupStores(supabase: SupabaseClient, _pref: string | null, limit: number = PICKUP_PER_PREF_LIMIT) {
  return getNationalPickupStores(supabase, limit);
}

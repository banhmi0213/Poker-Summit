// 店舗の契約プランごとの機能(2026/10、ライト/スタンダード/プレミアムの3段階化)。
// 上限そのものはDBトリガー(db/plan_tiers.sql)が強制する。ここは画面に
// 「あと何件」「このプランでは使えない」を事前に出すための読み取り用。

export type StorePlan = {
  planId: string;
  planName: string;
  jobLimit: number | null; // null = 無制限
  spotMonthlyLimit: number | null; // null = 無制限 / 0 = 利用不可
  pickup: boolean;
};

type PlanRow = {
  id: string;
  name: string;
  job_limit: number | null;
  spot_monthly_limit: number | null;
  pickup: boolean | null;
};

/** 店舗の有効な契約(status='active')のプラン。契約がなければ null。 */
export async function getStorePlan(supabase: any, storeId: string): Promise<StorePlan | null> {
  const { data } = await supabase
    .from("store_contracts")
    .select("plans!store_contracts_plan_id_fkey(id, name, job_limit, spot_monthly_limit, pickup), store_contract_addons(current_period_end, pending_removed_at, addons(code))")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const plan = (Array.isArray(data?.plans) ? data?.plans[0] : data?.plans) as PlanRow | null | undefined;
  if (!plan) return null;
  const now = Date.now();
  const extraJobs = (data?.store_contract_addons ?? []).filter((a: any) => {
    const addon = Array.isArray(a.addons) ? a.addons[0] : a.addons;
    return addon?.code === "job_listing"
      && (!a.current_period_end || Date.parse(a.current_period_end) > now)
      && (!a.pending_removed_at || Date.parse(a.pending_removed_at) > now);
  }).length;
  return {
    planId: plan.id,
    planName: plan.name,
    jobLimit: plan.job_limit === null ? null : plan.job_limit + extraJobs,
    spotMonthlyLimit: plan.spot_monthly_limit,
    pickup: !!plan.pickup,
  };
}

/** 契約なしは 0 件扱い。 */
export function jobLimitOf(plan: StorePlan | null): number | null {
  return plan ? plan.jobLimit : 0;
}

export function spotMonthlyLimitOf(plan: StorePlan | null): number | null {
  return plan ? plan.spotMonthlyLimit : 0;
}

export function limitLabel(limit: number | null) {
  return limit === null ? "無制限" : `${limit}件まで`;
}

/** 日本時間の今月1日 0:00 を ISO 文字列で。スポット求人の月間成立数の集計開始。 */
export function japanMonthStartIso(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000).toISOString();
}

/** 今月成立したスポット求人の件数(双方確定の遅いほうが今月のもの)。 */
export async function countSpotMatchesThisMonth(supabase: any, storeId: string) {
  const monthStart = japanMonthStartIso();
  const { data } = await supabase
    .from("dealer_matching_records")
    .select("store_confirmed_at, dealer_confirmed_at")
    .eq("store_id", storeId)
    .in("status", ["confirmed", "completed"])
    .or(`store_confirmed_at.gte.${monthStart},dealer_confirmed_at.gte.${monthStart}`);
  return (data ?? []).filter((r: { store_confirmed_at: string | null; dealer_confirmed_at: string | null }) => {
    const times = [r.store_confirmed_at, r.dealer_confirmed_at].filter(Boolean).map((t) => Date.parse(String(t)));
    return times.length > 0 && Math.max(...times) >= Date.parse(monthStart);
  }).length;
}

export const PICKUP_PREF_LIMIT = 10;

/** その都道府県のPICK UP枠(プレミアム)の残り。excludeStoreId はプラン変更時の自店舗。 */
export async function pickupSlotsLeft(supabase: any, pref: string | null, excludeStoreId?: string) {
  let query = supabase.from("stores").select("id", { count: "exact", head: true }).eq("is_recommended", true);
  query = pref ? query.eq("pref", pref) : query.is("pref", null);
  if (excludeStoreId) query = query.neq("id", excludeStoreId);
  const { count } = await query;
  return Math.max(0, PICKUP_PREF_LIMIT - (count ?? 0));
}

// ---------------------------------------------------------------------------
// 公開ページの表示用(優良店バッジ・金枠・地域一覧の表示順)

export type StoreDisplayFlags = { listPriority: number; goldFrame: boolean; verifiedBadge: boolean };

export async function fetchStoreDisplayFlags(supabase: any, storeIds: string[]) {
  const map = new Map<string, StoreDisplayFlags>();
  const ids = [...new Set(storeIds)].filter(Boolean);
  if (!ids.length) return map;
  const { data, error } = await supabase.rpc("store_display_flags", { p_store_ids: ids });
  if (error) {
    // 表示の飾りなので、取れなくてもページ自体は出す
    console.error("store_display_flags failed", error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.store_id, {
      listPriority: Number(row.list_priority) || 0,
      goldFrame: !!row.gold_frame,
      verifiedBadge: !!row.verified_badge,
    });
  }
  return map;
}

/** 表示優先度の高い順に並べ替え。同じ優先度の中では元の順番を保つ。 */
export function sortByListPriority<T extends { id: string }>(items: T[], flags: Map<string, StoreDisplayFlags>) {
  return items
    .map((item, index) => ({ item, index, priority: flags.get(item.id)?.listPriority ?? 0 }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map(({ item }) => item);
}

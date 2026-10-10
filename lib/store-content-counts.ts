import type { SupabaseClient } from "@supabase/supabase-js";

export type StoreContentCounts = { events: number; coupons: number; notices: number; jobs: number };
export const EMPTY_STORE_COUNTS: StoreContentCounts = { events: 0, coupons: 0, notices: 0, jobs: 0 };

/** Aggregate only public/active content for the store cards in four batched requests. */
export async function getStoreContentCounts(supabase: SupabaseClient, ids: string[]): Promise<Map<string, StoreContentCounts>> {
  const storeIds = [...new Set(ids.filter(Boolean))];
  const counts = new Map<string, StoreContentCounts>(storeIds.map(id => [id, { ...EMPTY_STORE_COUNTS }]));
  if (!storeIds.length) return counts;
  const now = new Date().toISOString();
  const results = await Promise.all([
    supabase.from("events").select("store_id").in("store_id", storeIds).eq("status", "published")
      .or(`and(end_at.not.is.null,end_at.gte.${now}),and(end_at.is.null,start_at.gte.${now})`),
    supabase.from("coupons").select("store_id").in("store_id", storeIds).eq("active", true)
      .or(`valid_until.is.null,valid_until.gte.${now}`),
    supabase.from("store_notices").select("store_id").in("store_id", storeIds).eq("status", "published"),
    supabase.from("jobs").select("store_id").in("store_id", storeIds).eq("status", "open"),
  ]);
  const keys: (keyof StoreContentCounts)[] = ["events", "coupons", "notices", "jobs"];
  results.forEach((result, index) => {
    if (result.error) { console.error("Store card count query failed:", keys[index], result.error.message); return; }
    for (const row of result.data ?? []) {
      const item = counts.get(row.store_id);
      if (item) item[keys[index]]++;
    }
  });
  return counts;
}

import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import type { StoreDisplayFlags } from "@/lib/plan-entitlements";
import { EMPTY_STORE_COUNTS, type StoreContentCounts } from "@/lib/store-content-counts";

// 店舗カードに出す「表紙写真・プランの飾り・イベント等の件数」を、掲載中の全店舗ぶん
// まとめて60秒キャッシュする(2026/10、表示速度対策)。
// ランキングやPICK UPのように毎回ランダムに選ばれる店舗でも、選んだ後にここから引けば
// データベースへ取りに行かずに済む。

async function loadAllStoreCardExtras() {
  const supabase = createAnonClient();
  const now = new Date().toISOString();

  const { data: storeRows, error } = await supabase.from("stores").select("id").in("status", ["approved", "listed"]);
  if (error) throw error;
  const ids = (storeRows ?? []).map((s) => s.id as string);

  const [{ data: photos }, flagsResult, events, coupons, notices, jobs] = await Promise.all([
    supabase.from("store_photos").select("store_id, url").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    ids.length ? supabase.rpc("store_display_flags", { p_store_ids: ids }) : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from("events")
      .select("store_id")
      .eq("status", "published")
      .not("store_id", "is", null)
      .or(`and(end_at.not.is.null,end_at.gte.${now}),and(end_at.is.null,start_at.gte.${now})`),
    supabase.from("coupons").select("store_id").eq("active", true).or(`valid_until.is.null,valid_until.gte.${now}`),
    supabase.from("store_notices").select("store_id").eq("status", "published"),
    supabase.from("jobs").select("store_id").eq("status", "open"),
  ]);

  const coverPhotos: Record<string, string> = {};
  (photos ?? []).forEach((p) => {
    if (!coverPhotos[p.store_id]) coverPhotos[p.store_id] = p.url;
  });

  const flags: Record<string, StoreDisplayFlags> = {};
  if (flagsResult.error) console.error("store_display_flags failed", flagsResult.error.message);
  for (const row of flagsResult.data ?? []) {
    flags[row.store_id] = {
      listPriority: Number(row.list_priority) || 0,
      goldFrame: !!row.gold_frame,
      verifiedBadge: !!row.verified_badge,
    };
  }

  const counts: Record<string, StoreContentCounts> = {};
  const add = (rows: { store_id: string | null }[] | null, key: keyof StoreContentCounts) => {
    for (const r of rows ?? []) {
      if (!r.store_id) continue;
      counts[r.store_id] ??= { ...EMPTY_STORE_COUNTS };
      counts[r.store_id][key]++;
    }
  };
  add(events.data, "events");
  add(coupons.data, "coupons");
  add(notices.data, "notices");
  add(jobs.data, "jobs");

  return { coverPhotos, flags, counts };
}

const getAllStoreCardExtrasCached = unstable_cache(loadAllStoreCardExtras, ["store-card-extras-v1"], {
  revalidate: 60,
  tags: ["public-stores"],
});

/** ページで使いやすい形(Map)にして返す */
export async function getStoreCardExtras() {
  const raw = await getAllStoreCardExtrasCached();
  return {
    coverPhotos: new Map(Object.entries(raw.coverPhotos)),
    flags: new Map(Object.entries(raw.flags)),
    counts: new Map(Object.entries(raw.counts)) as Map<string, StoreContentCounts>,
  };
}

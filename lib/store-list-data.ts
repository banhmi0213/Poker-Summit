import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { AREA_OPTIONS } from "@/lib/constants";
import { pickBanner } from "@/lib/banners";
import { isDesignatedCity } from "@/lib/city";
import { fetchStoreDisplayFlags, type StoreDisplayFlags } from "@/lib/plan-entitlements";
import { getStoreContentCounts, type StoreContentCounts } from "@/lib/store-content-counts";

// 店舗一覧(/stores・都道府県ページ・市区町村ページ)の「誰が見ても同じ」部分をまとめて取得し、
// 検索条件ごとに60秒キャッシュする(2026/10、表示速度対策)。
// 以前は表示のたびに全店舗の写真・プラン・掲載数をデータベースから取り直していた。
// 現在地からの距離順・お気に入りなど人によって変わる部分はページ側で計算する。

export function cityFilter<T extends { eq: Function; like: Function }>(query: T, city: string): T {
  return isDesignatedCity(city) ? query.like("city", `${city}%`) : query.eq("city", city);
}

export type StoreListFilters = {
  q: string;
  category: string;
  pref: string;
  region: string;
  city: string;
  area: string;
  /** 地方で絞ったときのランキング対象の都道府県(地方でなければ空) */
  rankingPrefs: string[];
};

async function loadStoreListData(f: StoreListFilters) {
  const supabase = createAnonClient();

  let storesQuery = supabase
    .from("stores")
    .select("id, name, category, region, pref, city, address, lat, lng, description, status, logo_url, banner_url")
    .in("status", ["approved", "listed"])
    // created_at が同じ行の並びを固定するため id でも並べる
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (f.q) {
    // 店名だけでなく住所・紹介文・エリアキーワード・市区町村・都道府県・地方でも探す
    const escaped = f.q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const pattern = `"%${escaped}%"`;
    storesQuery = storesQuery.or(
      [
        `name.ilike.${pattern}`,
        `address.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `area_keywords.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `pref.ilike.${pattern}`,
        `region.ilike.${pattern}`,
      ].join(",")
    );
  }
  if (f.category) storesQuery = storesQuery.eq("category", f.category);
  if (f.pref) storesQuery = storesQuery.eq("pref", f.pref);
  if (f.region) storesQuery = storesQuery.eq("region", f.region);
  if (f.city) storesQuery = cityFilter(storesQuery, f.city);
  if (f.area && f.pref) {
    const prefAreas = AREA_OPTIONS[f.pref] ?? [];
    const escapeIlike = (s: string) => s.replace(/\\/g, "\\\\").replace(/[%_]/g, (m) => `\\${m}`);
    if (f.area.startsWith("その他") && prefAreas.includes(f.area)) {
      // 「その他◯◯」は、同じ都道府県のほかのエリアのどれにも当たらない店
      prefAreas
        .filter((a) => a !== f.area)
        .forEach((a) => {
          const otherPattern = `%${escapeIlike(a)}%`;
          storesQuery = storesQuery.not("city", "ilike", otherPattern).not("area_keywords", "ilike", otherPattern);
        });
    } else {
      const escaped = f.area.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const pattern = `"%${escaped}%"`;
      storesQuery = storesQuery.or(`city.ilike.${pattern},area_keywords.ilike.${pattern}`);
    }
  }

  const [{ data: stores, error: storesError }, bannerPc, bannerMobile, rankingResult, { data: prefCityRows }] = await Promise.all([
    storesQuery,
    pickBanner(supabase, "store_list", { pref: f.pref, region: f.region, device: "pc" }),
    pickBanner(supabase, "store_list", { pref: f.pref, region: f.region, device: "mobile" }),
    f.pref || f.rankingPrefs.length
      ? supabase.rpc("public_store_rankings", { p_prefs: f.pref ? [f.pref] : f.rankingPrefs })
      : Promise.resolve({ data: [] as any[], error: null }),
    // 「市区町村から探す」リンク用(都道府県が決まっていてキーワード検索でないときだけ)
    f.pref && !f.q
      ? supabase.from("stores").select("city").eq("pref", f.pref).in("status", ["approved", "listed"]).not("city", "is", null)
      : Promise.resolve({ data: [] as { city: string | null }[] }),
  ]);
  if (storesError) throw storesError;
  if (rankingResult.error) throw rankingResult.error;
  const rankedStores = (rankingResult.data ?? []).slice(0, 4);

  const listIds = (stores ?? []).map((s) => s.id);
  const cardIds = [...new Set([...listIds, ...rankedStores.map((s: any) => s.id)])];

  const [{ data: photos }, flags, counts] = await Promise.all([
    cardIds.length
      ? supabase
          .from("store_photos")
          .select("store_id, url")
          .in("store_id", cardIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { store_id: string; url: string }[] }),
    fetchStoreDisplayFlags(supabase, cardIds),
    getStoreContentCounts(supabase, cardIds),
  ]);

  const coverPhotos: Record<string, string> = {};
  (photos ?? []).forEach((photo) => {
    if (!coverPhotos[photo.store_id]) coverPhotos[photo.store_id] = photo.url;
  });

  return {
    // 一覧カードでは紹介文を表示しないので、キャッシュを軽くするため短くしておく
    stores: (stores ?? []).map((s) => ({ ...s, description: s.description ? String(s.description).slice(0, 160) : s.description })),
    rankedStores,
    storeListBanner: [bannerPc, bannerMobile] as const,
    prefCities: (prefCityRows ?? []).map((r) => r.city),
    coverPhotos,
    // Map はキャッシュに入れられないので [id, 値] の配列にしておく
    flags: [...flags.entries()] as [string, StoreDisplayFlags][],
    counts: [...counts.entries()] as [string, StoreContentCounts][],
  };
}

export const STORE_LIST_CACHE_SECONDS = 60;

export const getStoreListData = unstable_cache(loadStoreListData, ["store-list-data-v1"], {
  revalidate: STORE_LIST_CACHE_SECONDS,
  tags: ["public-stores"],
});

/** 都道府県・市区町村ページのメタ情報(検索に出すかどうか)用の掲載店舗数。1時間キャッシュ。 */
export const getStoreCountForArea = unstable_cache(
  async (pref: string, city: string): Promise<number> => {
    const supabase = createAnonClient();
    let query = supabase.from("stores").select("id", { count: "exact", head: true }).eq("pref", pref).in("status", ["approved", "listed"]);
    if (city) query = cityFilter(query, city);
    const { count } = await query;
    return count ?? 0;
  },
  ["store-count-for-area-v1"],
  { revalidate: 3600, tags: ["public-stores"] }
);

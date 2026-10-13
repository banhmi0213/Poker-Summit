import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getNationalPickupStores, getRegionalPickupStores } from "@/lib/contracts";
import { getTopBanners, getHomeSectionBanners } from "@/lib/banners";
import { fetchStoreDisplayFlags, type StoreDisplayFlags } from "@/lib/plan-entitlements";
import { getStoreContentCounts, type StoreContentCounts } from "@/lib/store-content-counts";

// TOPページの「誰が見ても同じ」部分をまとめて取得し、60秒キャッシュする(2026/10、表示速度対策)。
// 以前は表示のたびにデータベースへ20回近く問い合わせていた(うち6回は順番待ち)。
// ログイン状態・お気に入りなど人によって変わる部分は、ページ側で別に取る。
// 店舗やイベントを更新してからTOPに反映されるまで最大60秒かかる。
export const HOME_CACHE_SECONDS = 60;

async function loadHomePublicData(currentPref: string | null) {
  const supabase = createAnonClient();
  const now = new Date().toISOString();

  const [
    { data: settings },
    statsResults,
    { data: memberCountRaw },
    featuredStoresAll,
    { data: latestJobs },
    { data: latestPosts },
    { data: upcomingEvents },
    { data: popularCoupons },
    topBannerRows,
    couponBannerRows,
    communityBannerRows,
    rankingBannerRows,
    jobsBannerRows,
    footerThreeBannerRows,
    rankingResult,
  ] = await Promise.all([
    supabase.from("site_settings").select("announcement").eq("id", true).maybeSingle(),
    Promise.all([
      supabase.from("stores").select("*", { count: "exact", head: true }).in("status", ["approved", "listed"]),
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("board_posts").select("*", { count: "exact", head: true }).eq("status", "visible"),
    ]),
    supabase.rpc("public_member_count"),
    currentPref ? getRegionalPickupStores(supabase, currentPref) : getNationalPickupStores(supabase),
    supabase
      .from("jobs")
      .select("id, title, job_type, salary, store_id, stores(name, category, pref, city, logo_url)")
      .eq("status", "open")
      .order("posted_at", { ascending: false })
      .limit(4),
    // /board一覧と同じ並び(返信で更新される updated_at の新しい順、同値は id 降順)
    supabase
      .from("board_posts")
      .select("id, title, author_name, created_at, updated_at")
      .eq("status", "visible")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(8),
    supabase
      .from("events")
      .select("id, title, location, start_at, end_at, category, banner_image_url, store_id, stores(name, pref, city)")
      .eq("status", "published")
      .or(`and(end_at.not.is.null,end_at.gte.${now}),and(end_at.is.null,start_at.gte.${now})`)
      .order("start_at", { ascending: true })
      .limit(8),
    supabase
      .from("coupons")
      .select("id, title, discount, valid_until, banner_image_url, store_id, stores(name, category, pref, city)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(3),
    getTopBanners(supabase),
    getHomeSectionBanners(supabase, "home_coupon"),
    getHomeSectionBanners(supabase, "home_community", 4),
    getHomeSectionBanners(supabase, "home_ranking"),
    getHomeSectionBanners(supabase, "home_jobs"),
    getHomeSectionBanners(supabase, "home_footer_three", 3),
    // TOPのランキングは訪問者の地域に関係なく全国
    supabase.rpc("public_store_rankings"),
  ]);
  if (rankingResult.error) throw rankingResult.error;

  const featuredStores = (featuredStoresAll ?? []).slice(0, 4);
  const rankedStores = (rankingResult.data ?? []).slice(0, 4);

  // 開催中のイベントがあればそれを、なければこれからのイベントを出す
  const liveEvents = (upcomingEvents ?? []).filter((ev: any) => ev.start_at && ev.start_at <= now).slice(0, 4);
  const nextEvents = (upcomingEvents ?? []).filter((ev: any) => !ev.start_at || ev.start_at > now).slice(0, 4);
  const isEventsLive = liveEvents.length > 0;
  const displayEvents = isEventsLive ? liveEvents : nextEvents;

  const cardStoreIds = [...featuredStores.map((s: any) => s.id), ...rankedStores.map((s: any) => s.id)];
  const photoStoreIds = [...new Set([...cardStoreIds, ...displayEvents.map((e: any) => e.store_id).filter(Boolean)])];
  const postIds = (latestPosts ?? []).map((p) => p.id);

  // ここから先は上の結果に依存するが、互いには独立なので同時に取る
  const [{ data: homePhotos }, flags, counts, { data: replyRows }] = await Promise.all([
    photoStoreIds.length
      ? supabase
          .from("store_photos")
          .select("store_id, url")
          .in("store_id", photoStoreIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { store_id: string; url: string }[] }),
    fetchStoreDisplayFlags(supabase, cardStoreIds),
    getStoreContentCounts(supabase, cardStoreIds),
    postIds.length
      ? supabase.from("board_replies").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const coverPhotos: Record<string, string> = {};
  (homePhotos ?? []).forEach((photo) => {
    if (!coverPhotos[photo.store_id]) coverPhotos[photo.store_id] = photo.url;
  });
  const replyCounts: Record<string, number> = {};
  (replyRows ?? []).forEach((r) => {
    replyCounts[r.post_id] = (replyCounts[r.post_id] ?? 0) + 1;
  });

  const [{ count: totalStoreCount }, { count: openJobCount }, { count: threadCount }] = statsResults;

  return {
    now,
    announcement: (settings?.announcement as string | null | undefined) ?? null,
    totalStoreCount: totalStoreCount ?? 0,
    openJobCount: openJobCount ?? 0,
    threadCount: threadCount ?? 0,
    memberCountRaw: (memberCountRaw as number | null) ?? null,
    featuredStores,
    rankedStores,
    latestJobs: latestJobs ?? [],
    latestPosts: latestPosts ?? [],
    displayEvents,
    isEventsLive,
    popularCoupons: popularCoupons ?? [],
    topBannerRows,
    couponBannerRows,
    communityBannerRows,
    rankingBannerRows,
    jobsBannerRows,
    footerThreeBannerRows,
    coverPhotos,
    replyCounts,
    // Map はキャッシュに入れられないので [id, 値] の配列にしておく
    flags: [...flags.entries()] as [string, StoreDisplayFlags][],
    counts: [...counts.entries()] as [string, StoreContentCounts][],
  };
}

export const getHomePublicData = unstable_cache(loadHomePublicData, ["home-public-data-v1"], {
  revalidate: HOME_CACHE_SECONDS,
  tags: ["public-stores"],
});

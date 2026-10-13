import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPickupPool } from "@/lib/contracts";
import { getTopBanners, getHomeSectionBanners } from "@/lib/banners";

// TOPページの部分のうち、表示のたびに変わらないものをまとめて取得し、60秒キャッシュする(2026/10、表示速度対策)。
// 地域(currentPref)ごとに別々にキャッシュする。ランキング(同数のときの順番がランダム)と
// PICK UP(契約店舗の並びがランダム)は、ここでは候補だけを取り、並べ替えはページ側で毎回行う。
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
    pickupPool,
    { data: latestJobs },
    { data: latestPosts },
    { data: upcomingEvents },
    { data: popularCoupons },
    topBannerRows,
    pickupBannerRows,
    couponBannerRows,
    communityBannerRows,
    rankingBannerRows,
    jobsBannerRows,
    footerThreeBannerRows,
  ] = await Promise.all([
    supabase.from("site_settings").select("announcement").eq("id", true).maybeSingle(),
    Promise.all([
      supabase.from("stores").select("*", { count: "exact", head: true }).in("status", ["approved", "listed"]),
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("board_posts").select("*", { count: "exact", head: true }).eq("status", "visible"),
    ]),
    supabase.rpc("public_member_count"),
    getPickupPool(supabase, currentPref),
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
    getHomeSectionBanners(supabase, "home_pickup"),
    getHomeSectionBanners(supabase, "home_coupon"),
    getHomeSectionBanners(supabase, "home_community", 4),
    getHomeSectionBanners(supabase, "home_ranking"),
    getHomeSectionBanners(supabase, "home_jobs"),
    getHomeSectionBanners(supabase, "home_footer_three", 3),
  ]);

  // 開催中のイベントがあればそれを、なければこれからのイベントを出す
  const liveEvents = (upcomingEvents ?? []).filter((ev: any) => ev.start_at && ev.start_at <= now).slice(0, 4);
  const nextEvents = (upcomingEvents ?? []).filter((ev: any) => !ev.start_at || ev.start_at > now).slice(0, 4);
  const isEventsLive = liveEvents.length > 0;
  const displayEvents = isEventsLive ? liveEvents : nextEvents;

  const postIds = (latestPosts ?? []).map((p) => p.id);
  const { data: replyRows } = postIds.length
    ? await supabase.from("board_replies").select("post_id").in("post_id", postIds)
    : { data: [] as { post_id: string }[] };
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
    pickupPool,
    latestJobs: latestJobs ?? [],
    latestPosts: latestPosts ?? [],
    displayEvents,
    isEventsLive,
    popularCoupons: popularCoupons ?? [],
    topBannerRows,
    pickupBannerRows,
    couponBannerRows,
    communityBannerRows,
    rankingBannerRows,
    jobsBannerRows,
    footerThreeBannerRows,
    replyCounts,
  };
}

export const getHomePublicData = unstable_cache(loadHomePublicData, ["home-public-data-v2"], {
  revalidate: HOME_CACHE_SECONDS,
  tags: ["public-stores"],
});

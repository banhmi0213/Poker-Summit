import Link from "next/link";
import { EventSign } from "./event-sign";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORY_OPTIONS,
  PREF_OPTIONS,
} from "@/lib/constants";
import { toggleFavoriteStore } from "./member-actions";
import { PortalHeader } from "./portal-header";
import { PortalFooter } from "./portal-footer";
import { BottomTabs } from "./bottom-tabs";
import { HomeStoreCard } from "./home-store-card";
import { PrefAreaSelect, ExpandableSearchForm } from "./pref-area-select";
import styles from "./home-search.module.css";
import { PokerRegionHero } from "./poker-region-hero";
import { PrefSelector } from "./pref-selector";
import { PrefGeoDetector } from "./pref-geo-detector";
import { GeolocateSearchButton } from "./geolocate-search-button";
import { getCurrentPref } from "@/lib/current-pref";
import { getPrefPickupStores, PICKUP_PER_PREF_LIMIT } from "@/lib/contracts";
import { getTopBanners, isExternalBannerLink } from "@/lib/banners";
import { HomeBannerSlider, type HomeBanner } from "./home-banner-slider";
import { headers } from "next/headers";

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

// --- Per-event status for the home page badges: live (started, not yet
// ended) / soon (starts within the next hour) / upcoming (everything else).
function getEventStatus(
  ev: { start_at: string | null; end_at: string | null },
  nowIso: string
): "live" | "soon" | "upcoming" {
  const nowMs = new Date(nowIso).getTime();
  const startMs = ev.start_at ? new Date(ev.start_at).getTime() : null;
  const endMs = ev.end_at ? new Date(ev.end_at).getTime() : null;

  if (startMs !== null && startMs <= nowMs && (endMs === null || endMs >= nowMs)) {
    return "live";
  }
  if (startMs !== null && startMs > nowMs && startMs - nowMs <= 60 * 60 * 1000) {
    return "soon";
  }
  return "upcoming";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; pref?: string; region?: string; area?: string };
}) {
  const params = searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const pref = params.pref ?? "";
  const region = params.region ?? "";
  const area = params.area ?? "";

  const supabase = await createClient();
  const now = new Date().toISOString();

  // "現在表示中の都道府県" — see lib/current-pref.ts. Read up front (cheap:
  // cookies/headers only, no DB round trip) so the PICK UP店舗 section below
  // can be filtered by it, same as /stores/featured already does.
  const { pref: currentPref, source: currentPrefSource } = await getCurrentPref();

  // Nationwide and prefecture views share randomized recommended priority
  // and refill up to ten stores. The home preview displays the first four.
  const pickupStoresPromise = getPrefPickupStores(supabase, currentPref, PICKUP_PER_PREF_LIMIT);

  // All of the following are independent of each other, so they're fired
  // together instead of one-by-one — the serial version of this page was
  // making 12+ round trips to the database back to back, which is what was
  // making the whole site feel slow to load.
  const [
    {
      data: { user },
    },
    { data: settings },
    statsResults,
    { data: memberCountRaw },
    featuredStoresAll,
    { data: latestJobs },
    { data: latestPosts },
    { data: upcomingEvents },
    { data: popularCoupons },
    topBannerRows,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("site_settings").select("announcement").eq("id", true).maybeSingle(),
    Promise.all([
      supabase
        .from("stores")
        .select("*", { count: "exact", head: true })
        .in("status", ["approved", "listed"]),
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase
        .from("board_posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "visible"),
    ]),
    // Real member count for the region-hero stats panel. auth.users isn't
    // queryable through PostgREST directly (no PII exposed here, just a
    // count), so this goes through a SECURITY DEFINER RPC.
    supabase.rpc("public_member_count"),
    pickupStoresPromise,
    supabase
      .from("jobs")
      .select("id, title, job_type, salary, store_id, stores(name, category, pref, city, logo_url)")
      .eq("status", "open")
      .order("posted_at", { ascending: false })
      .limit(4),
    // 「更新された順にTOPページにも来るように」との指示(2026/10)。/board
    // 一覧と同じく、返信があるたびに更新されるboard_posts.updated_atで
    // ソートする(新規投稿時点ではcreated_atと同じ値)。/boardと同じくid
    // の降順も付けておく: updated_atが同値(複数スレッドがまだ一度も
    // 更新されていない等)の場合、二次キーなしだとPostgresが順序を
    // 保証しないため、/board一覧と表示順がずれてしまう。
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
  ]);

  // TOPバナーのリンク先が自サイト以外なら別タブで開く(target="_blank")。
  // 本番ドメイン(pokersummit.jp / www付き)とpoker-summit.vercel.appは同じ
  // サイトとして扱う(lib/banners.ts の isExternalBannerLink)。
  const siteHost = headers().get("host") ?? "";
  const topBanners: HomeBanner[] = topBannerRows.map((b) => {
    const external = isExternalBannerLink(b.link_url, siteHost);
    return { id: b.id, title: b.title, image_url: b.image_url ?? "", link_url: b.link_url, external };
  });

  const [{ count: totalStoreCount }, { count: openJobCount }, { count: threadCount }] =
    statsResults;

  // --- Live vs upcoming events: prefer showing what's happening right now,
  // and only fall back to "coming up" events when nothing is live. ---
  const liveEvents = (upcomingEvents ?? []).filter((ev: any) => ev.start_at && ev.start_at <= now).slice(0, 4);
  const nextEvents = (upcomingEvents ?? [])
    .filter((ev: any) => !ev.start_at || ev.start_at > now)
    .slice(0, 4);
  const isEventsLive = liveEvents.length > 0;
  const displayEvents = isEventsLive ? liveEvents : nextEvents;

  // --- Favorites (depends on `user`, so it runs after the batch above) ---
  let favoriteStoreIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorite_stores")
      .select("store_id")
      .eq("user_id", user.id);
    favoriteStoreIds = new Set((favs ?? []).map((f) => f.store_id));
  }

  // --- Featured stores: PICK UP契約店舗優先+空き枠ランダム埋め(上のコメント
  // 参照)。ホームのプレビュー枠は4列×2行=8件なので、ここで最終的に切る。
  const featuredStores = (featuredStoresAll ?? []).slice(0, 4);

  // TOP ranks stores nationwide, independent of the visitor location.
  const { data: rankingRows, error: rankingError } = await supabase.rpc("public_store_rankings");
  if (rankingError) throw rankingError;
  const rankedStores = rankingRows ?? [];

  const photoStoreIds = [...new Set([
    ...featuredStores.map(s => s.id), ...rankedStores.map(s => s.id),
    ...displayEvents.map((e: any) => e.store_id).filter(Boolean),
  ])];
  const { data: homePhotos } = photoStoreIds.length
    ? await supabase.from("store_photos").select("store_id, url")
      .in("store_id", photoStoreIds).order("sort_order", { ascending: true }).order("created_at", { ascending: true })
    : { data: [] };
  const homeCoverPhotos = new Map<string, string>();
  (homePhotos ?? []).forEach(photo => { if (!homeCoverPhotos.has(photo.store_id)) homeCoverPhotos.set(photo.store_id, photo.url); });

  // --- Reply counts (depends on latestPosts, so it runs after the batch above) ---
  const postIds = (latestPosts ?? []).map((p) => p.id);
  const { data: replyRows } = postIds.length
    ? await supabase.from("board_replies").select("post_id").in("post_id", postIds)
    : { data: [] as { post_id: string }[] };
  const replyCounts: Record<string, number> = {};
  replyRows?.forEach((r) => {
    replyCounts[r.post_id] = (replyCounts[r.post_id] ?? 0) + 1;
  });

  return (
    <div>
      <PortalHeader userEmail={user?.email} regionSelector={<PrefSelector currentPref={currentPref} prefOptions={PREF_OPTIONS} />} />

      {settings?.announcement && (
        <div className="container" style={{ paddingBottom: 0 }}>
          <div
            className="card"
            style={{
              marginTop: 16,
              background: "var(--accent-soft)",
              borderColor: "var(--accent)",
              fontSize: 13.5,
            }}
          >
            {settings.announcement}
          </div>
        </div>
      )}

      <div className={`ps-region-hero__search ${styles.search}`}>
          <ExpandableSearchForm>
            {/* Same /stores search this site already runs — only the fields
                shown have changed (pref/area/category are now all visible,
                matching the approved comp), no new search logic. */}
            <input type="hidden" name="region" value={region} />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="店名やキーワードで検索"
              style={{ flex: "2 1 200px" }}
            />
            <PrefAreaSelect
              prefOptions={PREF_OPTIONS}
              prefLabel="都道府県"
              initialPref={pref}
              initialArea={area}
            />
            <select
              name="category"
              defaultValue={category}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border-strong)",
                background: "var(--surface-2)",
                fontSize: 13,
                flex: "1 1 160px",
              }}
            >
              <option value="">店舗タイプ: すべて</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <GeolocateSearchButton />
            <button type="submit" className="btn primary">
              🔍 検索する
            </button>
          </ExpandableSearchForm>
      </div>

      <PokerRegionHero
        stats={{
          storeCount: totalStoreCount ?? 0,
          jobCount: openJobCount ?? 0,
          memberCount: memberCountRaw ?? 0,
          summitPostCount: threadCount ?? 0,
        }}
      />

      {/* Invisible: silently asks the browser for the visitor's location and
          upgrades currentPref from IP-guess to a real geo result. Skipped
          once a manual choice or a still-fresh geo result already exists. */}
      <PrefGeoDetector skipDetect={currentPrefSource === "manual" || currentPrefSource === "geo"} />

      <main className={`home-feed ${styles.readable}`}>
        <section className="home-section">
          <div className="home-section-head"><h2><span>🏆</span> PICK UP店舗{currentPref ? `（${currentPref}）` : ""}</h2><Link href="/stores/featured">すべての店舗を見る →</Link></div>
          {!featuredStores.length && <p className="muted">{currentPref ? `${currentPref}にはまだPICK UP店舗がありません。` : "まだ店舗がありません。"}</p>}
          <div className="home-grid home-grid-four">{featuredStores.map(s => <HomeStoreCard key={s.id} store={s} coverPhoto={homeCoverPhotos.get(s.id)} isFavorite={favoriteStoreIds.has(s.id)} favoriteAction={async () => { "use server"; await toggleFavoriteStore(s.id, "/"); }} />)}</div>
        </section>
        {topBanners.length > 0 && (
          <div className="home-section">
            <HomeBannerSlider banners={topBanners} />
          </div>
        )}
        <section className="home-section">
          <div className="home-section-head"><h2><span>{isEventsLive ? "🔥" : "📅"}</span> {isEventsLive ? "開催中のトーナメント・イベント" : "開催予定のトーナメント・イベント"}</h2><Link href="/events">すべてのトーナメント・イベントを見る →</Link></div>
          {!displayEvents.length && <p className="muted">現在開催予定のイベントはありません。</p>}
          <div className="home-grid home-grid-four">{displayEvents.map((ev: any) => {
            const status = getEventStatus(ev, now);
            const photo = ev.banner_image_url;
            return <Link className="home-event-card" href={`/events/${ev.id}`} key={ev.id}>
              <div className="home-event-photo">{photo ? <img src={photo} alt={ev.title} loading="lazy" /> : <EventSign title={ev.title} category={ev.category} startAt={ev.start_at} venue={ev.stores?.name || ev.location} />}</div>
              <div className="home-event-body"><div className="home-event-date">{ev.start_at ? <><strong>{new Date(ev.start_at).toLocaleDateString("ja-JP", { month:"2-digit", day:"2-digit", timeZone:"Asia/Tokyo" })}</strong><span>{new Date(ev.start_at).toLocaleTimeString("ja-JP", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tokyo" })}</span></> : <span>日時未定</span>}</div>
                <div className="home-event-copy"><h3>{ev.title}</h3><p>{ev.stores?.name}</p><p className="home-location">📍 {[ev.stores?.pref, ev.stores?.city].filter(Boolean).join(" ") || ev.location}</p><span className="home-tag">{status === "live" ? "開催中" : status === "soon" ? "まもなく開催" : "開催予定"}</span><span className="home-card-cta">詳細を見る ›</span></div>
              </div>
            </Link>;
          })}</div>
        </section>
        <section className="home-section">
          <div className="home-section-head"><h2><span>🎟️</span> お得なクーポン</h2><Link href="/coupons">すべてのクーポンを見る →</Link></div>
          {!popularCoupons?.length && <p className="muted">現在利用可能なクーポンはありません。</p>}
          <div className="home-grid home-grid-three">{popularCoupons?.map((c: any) => <Link href={`/stores/${c.store_id}`} className="home-coupon-card" key={c.id}>
            <div className="home-coupon-image">{c.banner_image_url ? <img src={c.banner_image_url} alt={c.title} loading="lazy" /> : <div><span>COUPON</span><strong>{c.discount || "店舗特典"}</strong><span>POKER SUMMIT</span></div>}</div>
            <div className="home-coupon-copy"><h3>{c.title}</h3><p>{c.stores?.name}</p><p className="home-location">📍 {[c.stores?.pref,c.stores?.city].filter(Boolean).join(" ")}</p>{c.valid_until && <small>{formatDate(c.valid_until)}まで</small>}<span className="home-card-cta">条件を見る ›</span></div>
          </Link>)}</div>
        </section>

        <section className="home-section home-summit">
          <div className="home-section-head"><h2><span>💬</span> サミット｜情報交換</h2><Link href="/board">すべて見る →</Link></div>
          {!latestPosts?.length && <p className="muted">まだ投稿がありません。</p>}
          <div className="home-post-grid">{latestPosts?.map(p => <Link href={`/board/${p.id}`} key={p.id} className="home-post"><span className="home-post-icon">💬</span><div><h3>{p.title}</h3><p>{p.author_name} · 返信 {replyCounts[p.id] ?? 0}</p></div><b>›</b></Link>)}</div>
        </section>
        <section className="home-section">
          <div className="home-section-head"><h2><span>🏅</span> 店舗ランキング</h2></div>
          {!rankedStores.length && <p className="muted">まだ店舗がありません。</p>}
          <div className="home-grid home-grid-four">{rankedStores.map((s,idx) => <HomeStoreCard key={s.id} store={s} coverPhoto={homeCoverPhotos.get(s.id)} rank={idx+1} isFavorite={favoriteStoreIds.has(s.id)} favoriteAction={async () => { "use server"; await toggleFavoriteStore(s.id, "/"); }} />)}</div>
        </section>
        <section className="home-section">
          <div className="home-section-head"><h2><span>💼</span> 新着求人</h2><Link href="/jobs">すべての求人を見る →</Link></div>
          {!latestJobs?.length && <p className="muted">現在募集中の求人はありません。</p>}
          <div className="home-grid home-job-grid">{latestJobs?.map((j: any) => <Link href={`/stores/${j.store_id}`} className="home-job-card" key={j.id}>
            <div className="home-job-top"><div className="home-job-logo">{j.stores?.logo_url ? <img src={j.stores.logo_url} alt="" loading="lazy" /> : "♠"}</div><span className="home-tag">{j.job_type || "求人募集中"}</span></div>
            <h3>{j.title}</h3><p>{j.stores?.name}</p><p className="home-location">📍 {[j.stores?.pref,j.stores?.city].filter(Boolean).join(" ")}</p>
            {j.salary && <strong className="home-job-salary">{j.salary}</strong>}<span className="home-card-cta">募集詳細を見る ›</span>
          </Link>)}</div>
        </section>
        <section className={styles.promoGrid} aria-label="おすすめコンテンツ">
          <Link id="blog" href="/blog" className={styles.promoBanner} style={{ scrollMarginTop: 160 }}><img src="/images/blog-promo-square.jpg" alt="Poker Summit BLOG — ポーカーの楽しみ方がもっと広がる。ブログを読む" loading="lazy" /></Link>
        </section>
      </main>

      <div className="cta-banner">
        <div className="cta-banner-inner">
          <div className="cta-icon" style={{ fontSize: 32 }}>
            🃏
          </div>
          <div className="cta-body">
            <div className="eyebrow">POKER LOVERS COMMUNITY</div>
            <h2>ポーカー好きと、もっとつながる。</h2>
            <p>会員登録して、店舗情報や求人、全国の仲間との情報交換を楽しもう。</p>
            {user ? (
              <Link href="/mypage" className="btn-outline-gold">
                マイページへ
              </Link>
            ) : (
              <Link href="/signup" className="btn-outline-gold">
                無料で会員登録
              </Link>
            )}
          </div>
        </div>
      </div>

      <PortalFooter />
      <BottomTabs active="home" />
    </div>
  );
}

import { JobCategoryEntrances } from "./job-category-entrances";
import { CouponCategoryEntrances } from "./coupon-category-entrances";
import { couponCategoryHref } from "@/lib/coupon-categories";
import { ReadableName } from "@/app/readable-name";
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
import { isExternalBannerLink } from "@/lib/banners";
import { getHomePublicData } from "@/lib/home-data";
import { getStoreCardExtras } from "@/lib/store-card-extras";
import { getPrefStoreCounts } from "@/lib/pref-counts";
import { assemblePickup } from "@/lib/contracts";
import { bannersForDevice } from "@/lib/banners";
import { HomeBannerSlider, type HomeBanner } from "./home-banner-slider";
import { HomeSectionBanners } from "./home-section-banners";
import { HomeRankingBanner } from "./home-ranking-banner";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const HOME_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: `${SITE_NAME}｜${SITE_TAGLINE}`,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "ja",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/stores?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "株式会社Give Rise",
    url: `${SITE_URL}/`,
    brand: { "@type": "Brand", name: SITE_NAME },
  },
];

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

  // "現在表示中の都道府県" — see lib/current-pref.ts (cookies/headers only, no DB).
  const { pref: currentPref, source: currentPrefSource } = await getCurrentPref();

  // 表示のたびに変わらない部分(イベント・バナー・掲示板等)は lib/home-data.ts で
  // まとめて取得して60秒キャッシュし、ログイン状態だけをここで見る(2026/10、表示速度対策)。
  // ランキング(同数のときの順番がランダム)は表示のたびに取り直し、PICK UP の契約店舗も
  // 表示のたびに並べ替える。店舗カードの写真・件数等は全店舗ぶんのキャッシュから引く。
  const [
    {
      data: { user },
    },
    home,
    rankingResult,
    extras,
    prefCounts,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getHomePublicData(currentPref ?? null),
    // TOPのランキングは訪問者の地域に関係なく全国
    supabase.rpc("public_store_rankings"),
    getStoreCardExtras(),
    getPrefStoreCounts().catch(() => ({} as Record<string, number>)),
  ]);
  if (rankingResult.error) throw rankingResult.error;
  const featuredStores = assemblePickup(home.pickupPool).slice(0, 4);
  const rankedStores = (rankingResult.data ?? []).slice(0, 4);

  const {
    now,
    latestPosts,
    latestJobs,
    popularCoupons,
    displayEvents,
    isEventsLive,
    memberCountRaw,
    totalStoreCount,
    openJobCount,
    threadCount,
    replyCounts,
    topBannerRows,
    pickupBannerRows,
    couponBannerRows,
    communityBannerRows,
    rankingBannerRows,
    jobsBannerRows,
    footerThreeBannerRows,
  } = home;
  const settings = { announcement: home.announcement };
  const homeCoverPhotos = extras.coverPhotos;
  const homeStoreFlags = extras.flags;
  const homeContentCounts = extras.counts;

  // TOPバナーのリンク先が自サイト以外なら別タブで開く(target="_blank")。
  // 本番ドメイン(pokersummit.jp / www付き)とpoker-summit.vercel.appは同じ
  // サイトとして扱う(lib/banners.ts の isExternalBannerLink)。
  const siteHost = headers().get("host") ?? "";
  const topBanners: HomeBanner[] = topBannerRows.map((b) => {
    const external = isExternalBannerLink(b.link_url, siteHost);
    return { device: b.device, id: b.id, title: b.title, image_url: b.image_url ?? "", link_url: b.link_url, external };
  });

  const sectionBanners = (rows: typeof couponBannerRows): HomeBanner[] => rows.map((b) => ({
    device: b.device, id: b.id, title: b.title, image_url: b.image_url ?? "", link_url: b.link_url,
    external: isExternalBannerLink(b.link_url, siteHost),
  }));
  const pickupBanners = sectionBanners(pickupBannerRows);
  const couponBanners = sectionBanners(couponBannerRows);
  const communityBanners = sectionBanners(communityBannerRows);
  const rankingBanners = sectionBanners(rankingBannerRows);
  const jobsBanners = sectionBanners(jobsBannerRows);

  // --- Favorites (人によって変わるのでキャッシュしない) ---
  let favoriteStoreIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorite_stores")
      .select("store_id")
      .eq("user_id", user.id);
    favoriteStoreIds = new Set((favs ?? []).map((f) => f.store_id));
  }

  return (
    <div>
      <JsonLd data={HOME_JSON_LD} />
      <PortalHeader userEmail={user?.email} regionSelector={<PrefSelector currentPref={currentPref} prefOptions={PREF_OPTIONS} />} />

      {bannersForDevice(topBanners, "mobile").length > 0 && <div className="home-mobile-top-ad banner-mobile-only"><HomeBannerSlider banners={bannersForDevice(topBanners, "mobile")} /></div>}

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
          prefCount: Object.values(prefCounts).filter((n) => n > 0).length,
          majorTournamentCount: home.majorTournamentCount,
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
          <div className="home-section-head"><h2><span>🏆</span> {currentPref ? `${currentPref}のPICK UP店舗` : "PICK UP店舗"}</h2><Link href="/stores/featured">すべての店舗を見る</Link></div>
          {!featuredStores.length && <p className="muted">まだ店舗がありません。</p>}
          <div className="home-grid home-grid-four">{featuredStores.map(s => <HomeStoreCard key={s.id} store={s} contentCounts={homeContentCounts.get(s.id)} coverPhoto={homeCoverPhotos.get(s.id)} flags={homeStoreFlags.get(s.id)} isFavorite={favoriteStoreIds.has(s.id)} favoriteAction={async () => { "use server"; await toggleFavoriteStore(s.id, "/"); }} />)}</div>
        </section>
        {pickupBanners.length > 0 && <div className="home-section"><HomeSectionBanners banners={pickupBanners} layout="wide" pickup /></div>}
        {bannersForDevice(topBanners, "pc").length > 0 && (
          <div className="home-section banner-pc-only">
            <HomeBannerSlider banners={bannersForDevice(topBanners, "pc")} />
          </div>
        )}
        <section className="home-section">
          <div className="home-section-head"><h2><span>{isEventsLive ? "🔥" : "📅"}</span> {isEventsLive ? "開催中のトーナメント・イベント" : "開催予定のトーナメント・イベント"}</h2><Link href="/events">すべてのトーナメント・イベントを見る</Link></div>
          {!displayEvents.length && <p className="muted">現在開催予定のイベントはありません。</p>}
          <div className="home-grid home-grid-four">{displayEvents.map((ev: any) => {
            const status = getEventStatus(ev, now);
            const photo = ev.banner_image_url;
            return <Link className="home-event-card" href={ev.href || `/events/${ev.id}`} key={ev.id}>
              <div className="home-event-photo">{photo ? <img src={photo} alt={ev.title} loading="lazy" /> : <EventSign title={ev.title} category={ev.category} startAt={ev.start_at} dateOnly={ev.all_day} venue={ev.stores?.name || ev.location} />}</div>
              <div className="home-event-body"><div className="home-event-date">{ev.start_at ? <><strong>{new Date(ev.start_at).toLocaleDateString("ja-JP", { month:"2-digit", day:"2-digit", timeZone:"Asia/Tokyo" })}</strong><span>{ev.all_day ? (ev.end_date !== ev.start_date ? `〜${ev.end_date.slice(5).replace("-", "/")}` : "開催日") : new Date(ev.start_at).toLocaleTimeString("ja-JP", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tokyo" })}</span></> : <span>日時未定</span>}</div>
                <div className="home-event-copy"><h3><ReadableName name={ev.title} /></h3><p><ReadableName name={ev.stores?.name || ""} /></p><p className="home-location">📍 {[ev.stores?.pref, ev.stores?.city].filter(Boolean).join(" ") || ev.location}</p><span className="home-tag">{status === "live" ? "開催中" : status === "soon" ? "まもなく開催" : "開催予定"}</span><span className="home-card-cta">詳細を見る ›</span></div>
              </div>
            </Link>;
          })}</div>
        </section>
        {couponBanners.length > 0 && <div className="home-section"><HomeSectionBanners banners={couponBanners} layout="wide" /></div>}
        <section className="home-section">
          <div className="home-section-head"><h2><span>🎟️</span> お得なクーポン</h2><Link href={couponCategoryHref("", pref || (region ? "" : currentPref || ""), area, region)}>すべてのクーポンを見る</Link></div>
          <CouponCategoryEntrances pref={pref || (region ? "" : currentPref || "")} area={area} region={region} />
          {/* 新着クーポン(カテゴリ画像とクーポンバナーの間、2026/10)。新しい順に最大4件、1件から表示。0件なら出さない */}
          {popularCoupons.length > 0 && <div className="home-grid home-new-grid">{popularCoupons.map((c: any) => <Link href={`/coupons/${c.id}`} className="home-coupon-card home-coupon-card--vertical" key={c.id}>
            <div className="home-coupon-image">{c.banner_image_url ? <img src={c.banner_image_url} alt={c.title} loading="lazy" /> : <div><span>COUPON</span><strong>{c.discount || "店舗特典"}</strong><span>POKER SUMMIT</span></div>}</div>
            <div className="home-coupon-copy"><h3><ReadableName name={c.title} /></h3><p><ReadableName name={c.stores?.name || ""} /></p><p className="home-location">📍 {[c.stores?.pref, c.stores?.city].filter(Boolean).join(" ")}</p>{c.valid_until && <small>{formatDate(c.valid_until)}まで</small>}<span className="home-card-cta">条件を見る ›</span></div>
          </Link>)}</div>}
        </section>

        <div className="home-section"><HomeSectionBanners banners={[{ id: "coupon-section-artwork", title: "クーポンを探す", image_url: "/images/coupon-banner-light-v3.webp", link_url: "/coupons", external: false, device: "all" }]} layout="wide" /></div>
        {communityBanners.length > 0 && <div className="home-section"><HomeSectionBanners banners={communityBanners} layout="four" /></div>}
        <section className="home-section home-summit">
          <div className="home-section-head"><h2><span>💬</span> サミット｜情報交換</h2><Link href="/board">すべて見る</Link></div>
          {!latestPosts?.length && <p className="muted">まだ投稿がありません。</p>}
          <div className="home-post-grid">{latestPosts?.map(p => <Link href={`/board/${p.id}`} key={p.id} className="home-post"><span className="home-post-icon">💬</span><div><h3>{p.title}</h3><p>{p.author_name} · 返信 {replyCounts[p.id] ?? 0}</p></div><b>›</b></Link>)}</div>
        </section>
        {rankingBanners.length > 0 && <div className="home-section"><HomeSectionBanners banners={rankingBanners} layout="wide" /></div>}
        <section className="home-section">
          <div className="home-section-head"><h2><span>🏅</span> 店舗ランキング</h2><Link href="/stores/ranking">すべての店舗ランキングを見る</Link></div>
          {!rankedStores.length && <p className="muted">まだ店舗がありません。</p>}
          <div className="home-grid home-grid-four">{rankedStores.map((s,idx) => <HomeStoreCard key={s.id} store={s} contentCounts={homeContentCounts.get(s.id)} coverPhoto={homeCoverPhotos.get(s.id)} rank={idx+1} flags={homeStoreFlags.get(s.id)} isFavorite={favoriteStoreIds.has(s.id)} favoriteAction={async () => { "use server"; await toggleFavoriteStore(s.id, "/"); }} />)}</div>
        </section>
        <div className="home-section"><HomeRankingBanner stores={rankedStores} /></div>
        <section className="home-section">
          <div className="home-section-head"><h2><span>💼</span> 求人・スポット求人</h2><Link href="/jobs">求人・スポット求人を見る</Link></div>
          <JobCategoryEntrances pref={pref || currentPref || ""} />
          {/* 新着求人(職種画像と求人バナーの間、2026/10)。新しい順に最大4件、1件から表示。0件なら出さない */}
          {latestJobs.length > 0 && <div className="home-grid home-new-grid">{latestJobs.map((j: any) => <Link href={`/jobs/${j.id}`} className="home-job-card" key={j.id}>
            <div className="home-job-top"><div className="home-job-logo">{j.stores?.logo_url ? <img src={j.stores.logo_url} alt="" loading="lazy" /> : "♠"}</div><span className="home-tag">{j.job_type || "求人募集中"}</span></div>
            <h3><ReadableName name={j.title} /></h3><p><ReadableName name={j.stores?.name || ""} /></p><p className="home-location">📍 {[j.stores?.pref, j.stores?.city].filter(Boolean).join(" ")}</p>
            {j.salary && <strong className="home-job-salary">{j.salary}</strong>}<span className="home-card-cta">募集詳細を見る ›</span>
          </Link>)}</div>}
        </section>
        <div className="home-section"><HomeSectionBanners banners={[{ id: "jobs-section-artwork", title: "新着求人・スポット求人 — ポーカーが好き。その気持ちが、仕事のきっかけに。", image_url: "/images/jobs-banner-light-v6.webp", link_url: "/jobs", external: false, device: "all" }]} layout="wide" /></div>
        <section aria-label="無料ポーカー学習コース" style={{ margin: "26px 0", padding: "22px 24px", border: "1px solid #e4c98e", borderRadius: 14, background: "linear-gradient(110deg,#fff9e8,#fffdf8)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div><span style={{ color: "#9b7129", fontSize: 11, letterSpacing: "0.13em", fontWeight: 800 }}>POKER SUMMIT ACADEMY</span><h2 style={{ fontSize: "clamp(17px,2.4vw,24px)", margin: "7px 0" }}>遊びながら、ポーカーを学ぼう。</h2><p style={{ margin: 0, fontSize: 12, color: "#765f42" }}>ポジション・レンジ表・役の強さクイズを無料で体験。</p></div>
          <Link href="/learn" style={{ display: "inline-block", borderRadius: 9, padding: "13px 19px", background: "#d6ac49", color: "#2d200d", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>無料学習コースへ</Link>
        </section>
        {(["pc", "mobile"] as const).map(device => { const footerBanners = bannersForDevice(footerThreeBannerRows, device).slice(0, 3); return (
        <section key={device} className={`${styles.promoGrid} ${device === "pc" ? "banner-pc-only" : "banner-mobile-only"}`} aria-label="おすすめコンテンツ" id={device === "pc" ? "blog" : undefined} style={{ scrollMarginTop: 160 }}>
          {footerBanners.length > 0 ? footerBanners.map((b) => {
            const isMajorArtwork = b.image_url?.endsWith("/major-tournaments-square-v1.webp");
            const bannerClass = `${styles.promoBanner}${isMajorArtwork ? ` ${styles.majorPromo}` : ""}`;
            const image = <img src={b.image_url ?? ""} alt={b.title} loading="lazy" />;
            return b.link_url ? <a key={b.id} href={b.link_url} className={bannerClass} target={isExternalBannerLink(b.link_url, siteHost) ? "_blank" : undefined} rel={isExternalBannerLink(b.link_url, siteHost) ? "noopener noreferrer" : undefined}>{image}</a> : <div key={b.id} className={bannerClass}>{image}</div>;
          }) : <Link href="/blog" className={styles.promoBanner}><img src="/images/blog-promo-square.webp" alt="Poker Summit BLOG — ポーカーの楽しみ方がもっと広がる。ブログを読む" loading="lazy" /></Link>}
        </section>
        ); })}
      </main>

      <div className="cta-banner">
        <div className="cta-banner-inner">
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

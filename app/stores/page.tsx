import { CompactPortalBanner } from "@/app/compact-portal-banner";
import { STORES_PER_PAGE, paginateStores, storePageHref } from "@/lib/store-pagination";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AREA_OPTIONS, CATEGORY_OPTIONS, PREF_OPTIONS, PREF_REGION, PREF_REGION_ORDER, REGIONS } from "@/lib/constants";
import { toggleFavoriteStore } from "@/app/member-actions";
import { getStoreCountForArea, getStoreListData } from "@/lib/store-list-data";
import { getStoreCardExtras } from "@/lib/store-card-extras";
import { distanceKm } from "@/lib/geocode";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { HomeStoreCard } from "@/app/home-store-card";
import { sortByListPriority } from "@/lib/plan-entitlements";
import { StoreListCard } from "./store-list-card";
import { PrefAreaSelect, ExpandableSearchForm } from "@/app/pref-area-select";
import type { Metadata } from "next";
import { CATEGORY_LABEL } from "@/lib/constants";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGES, SITE_NAME, absoluteUrl, pageTitle } from "@/lib/seo";
import { JsonLd } from "@/lib/json-ld";
import { CITY_PAGE_MIN_STORES, cityPageHref, countCityPages, isDesignatedCity, prefPageHref } from "@/lib/city";

type StoreListParams = { q?: string; category?: string; pref?: string; city?: string; region?: string; area?: string; lat?: string; lng?: string; page?: string };

/** URLの city は都道府県が指定されているときだけ有効。変な値は無視する。 */
function validCity(pref: string, city: string | undefined) {
  const c = (city ?? "").trim();
  return pref && c && c.length <= 20 && /[市区町村]$/.test(c) ? c : "";
}

/** 市区町村で絞る(政令指定都市は配下の区もまとめる) */

// 都道府県・エリア・カテゴリで絞った一覧は「東京都のアミューズメントポーカー」等の
// 検索に当てたいので、それぞれ固有のタイトルとcanonicalを持たせる。
// キーワード検索・現在地検索の結果は無数に組み合わせがあるので検索結果に出さない。
export async function generateMetadata({ searchParams }: { searchParams: StoreListParams }): Promise<Metadata> {
  const pref = PREF_OPTIONS.includes(searchParams.pref ?? "") ? searchParams.pref! : "";
  const city = validCity(pref, searchParams.city);
  const region = !pref && REGIONS.includes(searchParams.region ?? "") ? searchParams.region! : "";
  const areaParam = searchParams.area?.trim() ?? "";
  const area = !city && pref && areaParam && (AREA_OPTIONS[pref] ?? []).includes(areaParam) && !areaParam.startsWith("その他") ? areaParam : "";
  const category = searchParams.category && CATEGORY_LABEL[searchParams.category] ? searchParams.category : "";
  const page = Number(searchParams.page) > 1 ? Math.floor(Number(searchParams.page)) : 1;

  const place = city ? `${pref}${city}` : area ? `${pref} ${area}` : pref || (region ? `${region}エリア` : "全国");
  const kind = category ? CATEGORY_LABEL[category] : "アミューズメントポーカー・ポーカーバー";
  const base = `${place}の${kind}一覧`;
  const title = pageTitle(page > 1 ? `${base}（${page}ページ目）` : base);
  const description = `${place}の${kind}を探すなら${SITE_NAME}。営業時間・アクセス・最寄り駅、開催中のトーナメントやイベント、求人・クーポン情報まで店舗ごとにまとめてチェックできます。`;

  const qs = new URLSearchParams();
  if (pref) qs.set("pref", pref);
  if (city) qs.set("city", city);
  if (area) qs.set("area", area);
  if (region) qs.set("region", region);
  if (category) qs.set("category", category);
  if (page > 1) qs.set("page", String(page));
  // 市区町村ページは /stores/area/東京都/新宿区 の形を正とする(/stores?pref=..&city=.. でも開ける)
  // 都道府県だけで絞ったページは /stores/area/東京都 の形を正とする
  const prefOnly = pref && !city && !area && !region && !category;
  const canonical = city
    ? `${cityPageHref(pref, city)}${page > 1 ? `?page=${page}` : ""}`
    : prefOnly
      ? `${prefPageHref(pref)}${page > 1 ? `?page=${page}` : ""}`
      : `/stores${qs.size ? `?${qs}` : ""}`;
  const isSearch = !!searchParams.q?.trim() || !!searchParams.lat || !!searchParams.lng;

  // 店舗が少なすぎる市区町村ページは中身が薄いので検索結果には出さない(リンクはたどれる)
  let thinCityPage = false;
  if (prefOnly && !isSearch) {
    // 掲載店舗が1店もない都道府県のページは検索結果に出さない
    thinCityPage = (await getStoreCountForArea(pref, "")) === 0;
  }
  if (city && !isSearch) {
    thinCityPage = (await getStoreCountForArea(pref, city)) < CITY_PAGE_MIN_STORES;
  }

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE_NAME, locale: "ja_JP", type: "website", images: DEFAULT_OG_IMAGES },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG_IMAGE] },
    ...(isSearch || thinCityPage ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    category?: string;
    pref?: string;
    region?: string;
    city?: string;
    area?: string;
    lat?: string;
    lng?: string;
    page?: string;
  };
}) {
  const q = searchParams.q?.trim() ?? "";
  const category = searchParams.category ?? "";
  const pref = searchParams.pref ?? "";
  const region = searchParams.region ?? "";
  const city = validCity(PREF_OPTIONS.includes(pref) ? pref : "", searchParams.city);
  const area = city ? "" : searchParams.area ?? "";

  // Present only when the visitor arrived via "現在地から探す" (top page) —
  // used to sort the results below by distance instead of the usual
  // newest-first order.
  const originLat = searchParams.lat ? Number(searchParams.lat) : null;
  const originLng = searchParams.lng ? Number(searchParams.lng) : null;
  const hasOrigin =
    typeof originLat === "number" &&
    !Number.isNaN(originLat) &&
    typeof originLng === "number" &&
    !Number.isNaN(originLng);

  // When arriving via a region chip (home page / prefecture map), narrow the
  // prefecture dropdown down to just that region's prefectures and relabel it
  // "エリア" instead of "都道府県" — otherwise show the full 47-prefecture list
  // as before. Prefectures that belong to more than one region (三重県) show
  // up under either.
  const isKnownRegion = REGIONS.includes(region);
  const regionPrefs = PREF_OPTIONS.filter((p) => PREF_REGION[p]?.includes(region));
  const regionOrder = PREF_REGION_ORDER[region];
  const prefOptionsForRegion = isKnownRegion
    ? regionOrder
      ? regionOrder.filter((p) => regionPrefs.includes(p))
      : regionPrefs
    : PREF_OPTIONS;
  // Labeled "都道府県エリア" (not just "エリア") when narrowed by a region chip,
  // so it reads clearly distinct from the neighborhood-level "エリア" dropdown
  // that sits right next to it once a prefecture is picked.
  const prefFieldLabel = isKnownRegion ? "都道府県エリア" : "都道府県";

  // Page heading, most specific wins: a chosen prefecture beats a chosen
  // region beats nothing at all (nationwide) — whether the prefecture came
  // from a region chip's narrowed "エリア" list or straight from the TOP
  // page's own 47-prefecture dropdown makes no difference.
  const pageHeading = pref
    ? `${pref}の店舗を探す`
    : isKnownRegion
    ? `${region}の店舗を探す`
    : "全国から店舗を探す";

  const supabase = await createClient();

  // 検索条件ごとに「誰が見ても同じ」部分は lib/store-list-data.ts でまとめて取得して
  // 60秒キャッシュし、ログイン状態とお気に入りだけをここで見る(2026/10、表示速度対策)。
  // ランキング(同数のときの順番がランダム)は表示のたびに取り直す。
  // 店舗カードの写真・件数等は全店舗ぶんのキャッシュから引く。
  const [
    {
      data: { user },
    },
    list,
    rankingResult,
    extras,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getStoreListData({ q, category, pref, region, city, area }),
    pref || isKnownRegion
      ? supabase.rpc("public_store_rankings", { p_prefs: pref ? [pref] : regionPrefs })
      : Promise.resolve({ data: [] as any[], error: null }),
    getStoreCardExtras(),
  ]);
  if (rankingResult.error) throw rankingResult.error;
  const stores = list.stores;
  const storeListBanner = list.storeListBanner;
  const rankedStores = (rankingResult.data ?? []).slice(0, 4);
  const coverPhotos = extras.coverPhotos;
  const displayFlags = extras.flags;
  const storeContentCounts = extras.counts;
  const cityLinks = hasOrigin
    ? []
    : Array.from(countCityPages(list.prefCities)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));

  let favoriteStoreIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorite_stores")
      .select("store_id")
      .eq("user_id", user.id);
    favoriteStoreIds = new Set((favs ?? []).map((f) => f.store_id));
  }

  // 「現在地から探す」で来たときは、いつもの新しい順ではなく現在地から近い順に並べる。
  // 座標がまだ無い店舗は距離を出せないので、外さずに最後に回す。
  type StoreWithDistance = (typeof stores)[number] & { distanceKm: number | null };
  let displayStores: StoreWithDistance[] = stores.map((s) => ({
    ...s,
    distanceKm:
      hasOrigin && typeof s.lat === "number" && typeof s.lng === "number"
        ? distanceKm(originLat as number, originLng as number, s.lat, s.lng)
        : null,
  }));
  if (hasOrigin) {
    displayStores = [...displayStores].sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  // 料金プランによる表示順(プレミアム → スタンダード → その他)。現在地から探す
  // 場合は距離順を優先する。同じプラン内では今まで通りの順番。
  if (!hasOrigin) displayStores = sortByListPriority(displayStores, displayFlags);

  const pagination = paginateStores(displayStores, searchParams.page);
  const pageNumbers = Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
    .filter(page => page === 1 || page === pagination.totalPages || Math.abs(page - pagination.page) <= 2);
  const pageHref = (page: number) =>
    city && !q && !category && !hasOrigin
      ? `${cityPageHref(pref, city)}${page > 1 ? `?page=${page}` : ""}`
      : PREF_OPTIONS.includes(pref) && !city && !area && !region && !q && !category && !hasOrigin
        ? `${prefPageHref(pref)}${page > 1 ? `?page=${page}` : ""}`
        : storePageHref({ ...searchParams, city: city || undefined }, page);

  // 見出しはページタイトル(generateMetadata)と同じ地名に揃える。
  // 都道府県で絞っていればその都道府県(エリア指定があれば併記)、地方だけなら地方名、それ以外は全国。
  const heroArea = pref && area && (AREA_OPTIONS[pref] ?? []).includes(area) && !area.startsWith("その他") ? area : "";
  const heroPlace = pref
    ? `${pref}${city ? city : heroArea ? ` ${heroArea}` : ""}`
    : isKnownRegion
      ? region
      : "全国";

  // 都道府県・市区町村ページのパンくず(検索結果にパンくずとして表示される)
  const listCrumbs = PREF_OPTIONS.includes(pref) && !q && !hasOrigin
    ? [
        { name: "TOP", item: absoluteUrl("/") },
        { name: "店舗を探す", item: absoluteUrl("/stores") },
        { name: pref, item: absoluteUrl(prefPageHref(pref)) },
        ...(city ? [{ name: city, item: absoluteUrl(cityPageHref(pref, city)) }] : []),
      ]
    : null;
  // 一覧に出ている店舗(このページ分)を ItemList として示す
  const listItems = !q && !hasOrigin ? pagination.items.map((s: any, i: number) => ({ "@type": "ListItem", position: (pagination.page - 1) * STORES_PER_PAGE + i + 1, url: absoluteUrl(`/stores/${s.id}`), name: s.name })) : [];

  return (
    <div>
      {listCrumbs && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: listCrumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
          }}
        />
      )}
      {listItems.length > 0 && <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", itemListElement: listItems }} />}
      <PortalHeader userEmail={user?.email} />
      <div className="container sl-page">
        <nav aria-label="戻るリンク" style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
          <Link href={city ? prefPageHref(pref) : pref || region || area ? "/stores" : "/"} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 14, fontWeight: 600 }}>
            {city ? `← ${pref}の店舗一覧` : pref || region || area ? "← 店舗を探す" : "← TOPに戻る"}
          </Link>
        </nav>
        <div className="store-mobile-banner">
          <CompactPortalBanner image="/images/poker-store-finder-banner.webp"
            eyebrow="FIND YOUR POKER SPOT"
            title={`${heroPlace}のポーカースポットを探す`}
            subtitle="看板から見つける、あなたの次の一軒。" />
        </div>
        <section className="sl-hero" aria-label="店舗検索">
          <span>FIND YOUR POKER SPOT</span>
          <h1>{heroPlace}のポーカースポットを探す</h1>
          <p>看板から見つける、あなたの次の一軒。</p>
        </section>
        {storeListBanner.map((banner, i) => banner && (
          <a key={i} className={i === 0 ? "banner-pc-only" : "banner-mobile-only"}
            href={`/go/banner/${banner.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", maxWidth: 760, margin: "16px auto 0" }}
          >
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {banner.image_url ? (
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  style={{ width: "100%", display: "block" }}
                />
              ) : (
                <div style={{ padding: 16 }}>{banner.title}</div>
              )}
            </div>
          </a>
        ))}

        {hasOrigin && (
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
            📍 現在地から近い順に表示しています
          </p>
        )}

        <ExpandableSearchForm
          className=""
          style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}
        >
          {/* region isn't its own dropdown here (only q / pref / category are),
              but it's preserved as a hidden field so links that arrive with a
              region filter (the region chips, the prefecture map) don't lose
              it when the visitor refines with a keyword or category. */}
          <input type="hidden" name="region" value={region} />
          {/* Carry the "現在地から探す" origin through a keyword/category
              refinement on this page too, so the distance sort doesn't reset
              just because the visitor narrowed the results further. */}
          {hasOrigin && (
            <>
              <input type="hidden" name="lat" value={String(originLat)} />
              <input type="hidden" name="lng" value={String(originLng)} />
            </>
          )}
          {/* Once a specific prefecture is already fixed (came straight from
              the TOP page's own 47-prefecture dropdown, or from a region
              chip's narrowed selector after a prefecture was picked there),
              re-showing a whole prefecture dropdown is redundant — the
              heading above already says which one. Keep it in the form via
              a hidden field and show only the neighborhood-level エリア
              select for that fixed prefecture instead. */}
          {pref && <input type="hidden" name="pref" value={pref} />}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="店名やキーワードで検索"
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "2 1 220px",
            }}
          />
          {pref ? (
            <select
              name="area"
              defaultValue={area}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border-strong)",
                background: "var(--surface-2)",
                fontSize: 13,
                flex: "1 1 160px",
              }}
            >
              <option value="">エリア: すべて</option>
              {(AREA_OPTIONS[pref] ?? []).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          ) : (
            <PrefAreaSelect
              prefOptions={prefOptionsForRegion}
              prefLabel={prefFieldLabel}
              initialPref={pref}
              initialArea={area}
            />
          )}
          <select
            name="category"
            defaultValue={category}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "1 1 180px",
            }}
          >
            <option value="">店舗タイプ: すべて</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn primary" style={{ fontSize: 13 }}>
            検索
          </button>
        </ExpandableSearchForm>

        {(pref || city) && !q && !hasOrigin && displayStores.length > 0 && (
          <p className="sl-intro" style={{ fontSize: 13.5, lineHeight: 1.8, margin: "0 0 18px", color: "var(--muted, #666)" }}>
            {heroPlace}には、{SITE_NAME}に掲載中の{category ? CATEGORY_LABEL[category] ?? "ポーカースポット" : "アミューズメントポーカー店・ポーカーバー"}が{displayStores.length}店舗あります。
            営業時間や最寄り駅、開催予定のトーナメント・イベント、クーポン情報を店舗ごとにチェックして、近くのポーカースポットを見つけてください。
          </p>
        )}

        {displayStores.length === 0 && (
          <p className="muted">条件に一致する店舗はありません。</p>
        )}

        <div
          className="sl-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {pagination.items.map((s) => (
            <StoreListCard
              key={s.id}
              store={s}
              coverPhoto={coverPhotos.get(s.id)}
              isFavorite={favoriteStoreIds.has(s.id)}
              distanceKm={s.distanceKm}
              flags={displayFlags.get(s.id)}
              favoriteAction={async () => {
                "use server";
                await toggleFavoriteStore(s.id, "/stores");
              }}
            />
          ))}
        </div>
        {pagination.totalPages > 0 && (
          <nav aria-label="店舗一覧のページ切り替え" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 26 }}>
            {pagination.page > 1 ? <Link className="chip" href={pageHref(pagination.page - 1)} rel="prev">‹ 前へ</Link> : <span className="chip" aria-disabled="true" style={{ opacity: 0.4 }}>‹ 前へ</span>}
            {pageNumbers.map((page, index) => <span key={page} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {index > 0 && page - pageNumbers[index - 1] > 1 && <span aria-hidden="true">…</span>}
              <Link className={`chip ${page === pagination.page ? "active" : ""}`} href={pageHref(page)} aria-label={`${page}ページ目`} aria-current={page === pagination.page ? "page" : undefined}>{page}</Link>
            </span>)}
            {pagination.page < pagination.totalPages ? <Link className="chip" href={pageHref(pagination.page + 1)} rel="next">次へ ›</Link> : <span className="chip" aria-disabled="true" style={{ opacity: 0.4 }}>次へ ›</span>}
          </nav>
        )}

        {cityLinks.length > 1 && (
          <section className="home-section" style={{ marginTop: 32 }} aria-label="市区町村から探す">
            <div className="home-section-head"><h2>{pref}の市区町村から探す</h2></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cityLinks.map(([name, n]) => (
                <Link
                  key={name}
                  href={cityPageHref(pref, name)}
                  className={`chip ${name === city ? "active" : ""}`}
                  aria-current={name === city ? "page" : undefined}
                >
                  {name}（{n}）
                </Link>
              ))}
            </div>
          </section>
        )}

        {(pref || isKnownRegion) && (
          <section className="home-section" style={{ marginTop: 36 }}>
            <div className="home-section-head"><h2>🏅 店舗ランキング（{pref || region}）</h2><Link href={`/stores/ranking?${pref ? `pref=${encodeURIComponent(pref)}` : `region=${encodeURIComponent(region)}`}`}>すべての店舗ランキングを見る →</Link></div>
            {!rankedStores.length && <p className="muted">まだ店舗がありません。</p>}
            <div className="home-grid home-grid-four">{rankedStores.map((s: any, index: number) => (
              <HomeStoreCard key={s.id} store={s} contentCounts={storeContentCounts.get(s.id)} rank={index + 1} coverPhoto={coverPhotos.get(s.id)} isFavorite={favoriteStoreIds.has(s.id)} flags={displayFlags.get(s.id)} favoriteAction={async () => {
                "use server";
                await toggleFavoriteStore(s.id, "/stores");
              }} />
            ))}</div>
          </section>
        )}
      </div>
      <PortalFooter />
      <BottomTabs active="stores" />
    </div>
  );
}

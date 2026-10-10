import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PREF_OPTIONS, PREF_REGION, REGIONS } from "@/lib/constants";
import { HomeStoreCard } from "@/app/home-store-card";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { toggleFavoriteStore } from "@/app/member-actions";
import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata({ searchParams }: { searchParams: { pref?: string; region?: string } }): Metadata {
  const pref = PREF_OPTIONS.includes(searchParams.pref ?? "") ? searchParams.pref! : "";
  const region = !pref && REGIONS.includes(searchParams.region ?? "") ? searchParams.region! : "";
  const place = pref || (region ? `${region}エリア` : "全国");
  const qs = pref ? `?pref=${encodeURIComponent(pref)}` : region ? `?region=${encodeURIComponent(region)}` : "";
  return staticPageMetadata({
    title: `${place}のポーカー店ランキング`,
    description: `${place}で人気のアミューズメントポーカー店・ポーカーバーのランキング。営業時間・アクセス・イベント情報もPoker Summitでチェックできます。`,
    path: `/stores/ranking${qs}`,
  });
}

export default async function StoreRankingPage({ searchParams }: {
  searchParams: { pref?: string; region?: string };
}) {
  const pref = PREF_OPTIONS.includes(searchParams.pref ?? "") ? searchParams.pref! : "";
  const region = REGIONS.includes(searchParams.region ?? "") ? searchParams.region! : "";
  const prefs = pref ? [pref] : region ? PREF_OPTIONS.filter(p => PREF_REGION[p]?.includes(region)) : null;
  const query = new URLSearchParams(pref ? { pref } : region ? { region } : {}).toString();
  const path = "/stores/ranking" + (query ? "?" + query : "");
  const supabase = await createClient();
  const [auth, result] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("public_store_rankings", { p_prefs: prefs }),
  ]);
  if (result.error) throw result.error;
  const stores = result.data ?? [];
  const user = auth.data.user;
  const [photos, favorites] = await Promise.all([
    stores.length ? supabase.from("store_photos").select("store_id, url")
      .in("store_id", stores.map((s: any) => s.id)).order("sort_order").order("created_at") : Promise.resolve({ data: [] }),
    user ? supabase.from("favorite_stores").select("store_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
  ]);
  const covers = new Map<string, string>();
  (photos.data ?? []).forEach((p: any) => { if (!covers.has(p.store_id)) covers.set(p.store_id, p.url); });
  const favoriteIds = new Set((favorites.data ?? []).map((f: any) => f.store_id));
  return <div>
    <PortalHeader userEmail={user?.email} />
    <main className="container">
      <Link href={query ? "/stores?" + query : "/"} className="btn">{query ? "← 店舗を探す" : "← TOPに戻る"}</Link>
      <section className="home-section">
        <div className="home-section-head"><h1>店舗ランキング{pref || region ? "（" + (pref || region) + "）" : "（全国）"}</h1></div>
        {!stores.length && <p className="muted">まだ店舗がありません。</p>}
        <div className="home-grid home-grid-four">{stores.map((s: any, index: number) =>
          <HomeStoreCard key={s.id} store={s} rank={index + 1} coverPhoto={covers.get(s.id)}
            isFavorite={favoriteIds.has(s.id)} favoriteAction={async () => {
              "use server";
              await toggleFavoriteStore(s.id, path);
            }} />
        )}</div>
      </section>
    </main>
    <PortalFooter />
    <BottomTabs active="stores" />
  </div>;
}

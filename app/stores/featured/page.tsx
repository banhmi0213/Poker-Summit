import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteStore } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { StoreCard } from "@/app/store-card";
import { getStoreContentCounts } from "@/lib/store-content-counts";
import { getCurrentPref } from "@/lib/current-pref";
import { getNationalPickupStores, getRegionalPickupStores } from "@/lib/contracts";
import { fetchStoreDisplayFlags } from "@/lib/plan-entitlements";
import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo";

// Match the TOP PICK UP section to the currently displayed location.
export const metadata: Metadata = staticPageMetadata({
  title: "PICK UP店舗一覧",
  description: "Poker Summitが注目するアミューズメントポーカー店・ポーカーバーのPICK UP店舗一覧。全国・都道府県ごとのおすすめ店舗をチェックできます。",
  path: "/stores/featured",
});

export default async function FeaturedStoresPage() {
  const supabase = await createClient();
  const { pref: currentPref } = await getCurrentPref();

  const [
    {
      data: { user },
    },
    stores,
  ] = await Promise.all([supabase.auth.getUser(), currentPref ? getRegionalPickupStores(supabase, currentPref) : getNationalPickupStores(supabase)]);

  const storeContentCounts = await getStoreContentCounts(supabase, (stores ?? []).map((s: { id: string }) => s.id));
  const storeFlags = await fetchStoreDisplayFlags(
    supabase,
    (stores ?? []).map((s: { id: string }) => s.id)
  );

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
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ paddingTop: 12, paddingBottom: 0 }}><Link href="/" style={{ color: "#99742f", fontSize: 13, fontWeight: 600 }}>← TOPに戻る</Link></div>
      <div className="container">
        <h1 style={{ fontSize: 22, marginTop: 20, marginBottom: 16 }}>
          🏆 {currentPref ? `${currentPref}のPICK UP店舗一覧` : "PICK UP店舗一覧"}
        </h1>

        {(!stores || stores.length === 0) && (
          <p className="muted">
            まだPICK UP店舗がありません。
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {stores?.map((s) => (
            <StoreCard
              key={s.id}
              store={s}
              contentCounts={storeContentCounts.get(s.id)}
              isFavorite={favoriteStoreIds.has(s.id)}
              flags={storeFlags.get(s.id)}
              favoriteAction={async () => {
                "use server";
                await toggleFavoriteStore(s.id, "/stores/featured");
              }}
            />
          ))}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs active="stores" />
    </div>
  );
}

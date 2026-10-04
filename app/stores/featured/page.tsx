import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteStore } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { StoreCard } from "@/app/store-card";
import { getCurrentPref } from "@/lib/current-pref";
import { getPrefPickupStores, PICKUP_PER_PREF_LIMIT } from "@/lib/contracts";

// Same randomized recommended priority and ten-store refill as the TOP page,
// scoped to the selected prefecture, or nationwide when none is selected.
export default async function FeaturedStoresPage() {
  const supabase = await createClient();
  const { pref: currentPref } = await getCurrentPref();

  const storesPromise = getPrefPickupStores(supabase, currentPref, PICKUP_PER_PREF_LIMIT);

  const [
    {
      data: { user },
    },
    stores,
  ] = await Promise.all([supabase.auth.getUser(), storesPromise]);

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
          🏆 PICK UP店舗一覧{currentPref ? `（${currentPref}）` : "（全国）"}
        </h1>

        {(!stores || stores.length === 0) && (
          <p className="muted">
            {currentPref
              ? `${currentPref}にはまだPICK UP店舗がありません。`
              : "まだPICK UP店舗がありません。"}
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
              isFavorite={favoriteStoreIds.has(s.id)}
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

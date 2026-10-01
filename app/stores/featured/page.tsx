import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteStore } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { StoreCard } from "@/app/store-card";
import { getCurrentPref } from "@/lib/current-pref";

// The "すべて見る →" destination from the home page's 🏆PICK UP店舗 section.
// Shows every admin-curated recommended store (stores.is_recommended = true,
// set from the 店舗管理 admin screen) — not the general /stores directory.
// Filtered by the site-wide "現在表示中の都道府県" (see lib/current-pref.ts)
// rather than a URL param, so it always stays in sync with the same
// cookie-backed state the TOP page's PICK UP section uses. The "最大10店舗/
// 都道府県" cap and PICK UP's future 公平なランダム表示 ordering are deferred
// future work — this page still shows the full unlimited list.
export default async function FeaturedStoresPage() {
  const supabase = await createClient();
  const { pref: currentPref } = await getCurrentPref();

  let storesQuery = supabase
    .from("stores")
    .select("id, name, category, region, pref, city, address, lat, lng, description, status, logo_url")
    .in("status", ["approved", "listed"])
    .eq("is_recommended", true);
  if (currentPref) storesQuery = storesQuery.eq("pref", currentPref);
  storesQuery = storesQuery
    // Secondary sort by id: created_at alone ties for rows inserted in the
    // same batch, and Postgres doesn't guarantee a stable order for ties.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  const [
    {
      data: { user },
    },
    { data: stores },
  ] = await Promise.all([supabase.auth.getUser(), storesQuery]);

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
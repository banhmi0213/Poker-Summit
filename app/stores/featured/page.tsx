import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteStore } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { StoreCard } from "@/app/store-card";

// The "すべて見る →" destination from the home page's 🏆PICK UP店舗 section.
// Shows every admin-curated recommended store (stores.is_recommended = true,
// set from the 店舗管理 admin screen) — not the general /stores directory.
export default async function FeaturedStoresPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: stores },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("stores")
      .select("id, name, category, region, pref, city, description, status")
      .in("status", ["approved", "listed"])
      .eq("is_recommended", true)
      // Secondary sort by id: created_at alone ties for rows inserted in the
      // same batch, and Postgres doesn't guarantee a stable order for ties.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
  ]);

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
        <h1 style={{ fontSize: 22, marginTop: 20, marginBottom: 16 }}>🏆 PICK UP店舗一覧</h1>

        {(!stores || stores.length === 0) && (
          <p className="muted">まだPICK UP店舗がありません。</p>
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
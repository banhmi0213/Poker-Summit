import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleFavoriteStore } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { StoreCard } from "@/app/store-card";
import { getCurrentPref } from "@/lib/current-pref";
import { getPrefPickupStores, PICKUP_PER_PREF_LIMIT } from "@/lib/contracts";

// The "すべて見る →" destination from the home page's 🏆PICK UP店舗 section.
// Filtered by the site-wide "現在表示中の都道府県" (see lib/current-pref.ts)
// rather than a URL param, so it always stays in sync with the same
// cookie-backed state the TOP page's PICK UP section uses.
//
// 都道府県が特定できている時は、PICK UP契約店舗(stores.is_recommended=true)
// を優先的に上位表示しつつ、契約が「都道府県ごと最大10店舗」に満たない分は
// 非契約の承認済み店舗からランダムに抽選して埋める(2026/10、「PICKUPが
// 埋まってない場合はランダムで出す」との指示。ロジック本体は
// lib/contracts.ts の getPrefPickupStores 参照)。都道府県未特定(全国表示)の
// 場合は47都道府県分を1つの10件枠として扱う意味がないため、従来通り
// 契約店舗のみを新着順で無制限に表示する。
export default async function FeaturedStoresPage() {
  const supabase = await createClient();
  const { pref: currentPref } = await getCurrentPref();

  const storesPromise: Promise<any[]> = currentPref
    ? getPrefPickupStores(supabase, currentPref, PICKUP_PER_PREF_LIMIT)
    : supabase
        .from("stores")
        .select("id, name, category, region, pref, city, address, lat, lng, description, status, logo_url")
        .in("status", ["approved", "listed"])
        .eq("is_recommended", true)
        // Secondary sort by id: created_at alone ties for rows inserted in the
        // same batch, and Postgres doesn't guarantee a stable order for ties.
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .then((r) => r.data ?? []);

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

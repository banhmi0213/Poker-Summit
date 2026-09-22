import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_OPTIONS, PREF_OPTIONS, PREF_REGION, REGIONS } from "@/lib/constants";
import { toggleFavoriteStore } from "@/app/member-actions";
import { pickBanner } from "@/lib/banners";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { StoreCard } from "@/app/store-card";

export default async function StoresPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; pref?: string; region?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const category = searchParams.category ?? "";
  const pref = searchParams.pref ?? "";
  const region = searchParams.region ?? "";

  // When arriving via a region chip (home page / prefecture map), narrow the
  // prefecture dropdown down to just that region's prefectures and relabel it
  // "エリア" instead of "都道府県" — otherwise show the full 47-prefecture list
  // as before. Prefectures that belong to more than one region (三重県) show
  // up under either.
  const isKnownRegion = REGIONS.includes(region);
  const prefOptionsForRegion = isKnownRegion
    ? PREF_OPTIONS.filter((p) => PREF_REGION[p]?.includes(region))
    : PREF_OPTIONS;
  const prefFieldLabel = isKnownRegion ? "エリア" : "都道府県";

  const supabase = await createClient();

  let storesQuery = supabase
    .from("stores")
    .select("id, name, category, region, pref, city, description, status")
    .in("status", ["approved", "listed"])
    .order("created_at", { ascending: false });

  if (q) {
    // Widen the free-word search beyond just the store name: match address,
    // description, city, pref/region, and the owner-editable "area keywords"
    // field (e.g. "ミナミ アメ村 心斎橋") so nickname/area searches work even
    // without a dedicated region dropdown in the UI.
    const escaped = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const pattern = `"%${escaped}%"`;
    storesQuery = storesQuery.or(
      [
        `name.ilike.${pattern}`,
        `address.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `area_keywords.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `pref.ilike.${pattern}`,
        `region.ilike.${pattern}`,
      ].join(",")
    );
  }
  if (category) {
    storesQuery = storesQuery.eq("category", category);
  }
  if (pref) {
    storesQuery = storesQuery.eq("pref", pref);
  }
  if (region) {
    storesQuery = storesQuery.eq("region", region);
  }

  const [
    {
      data: { user },
    },
    { data: stores },
    storeListBanner,
  ] = await Promise.all([
    supabase.auth.getUser(),
    storesQuery,
    pickBanner(supabase, "store_list", { pref, region }),
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
        {storeListBanner && (
          <a
            href={`/go/banner/${storeListBanner.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", maxWidth: 760, margin: "16px auto 0" }}
          >
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {storeListBanner.image_url ? (
                <img
                  src={storeListBanner.image_url}
                  alt={storeListBanner.title}
                  style={{ width: "100%", display: "block" }}
                />
              ) : (
                <div style={{ padding: 16 }}>{storeListBanner.title}</div>
              )}
            </div>
          </a>
        )}

        <h1 style={{ fontSize: 22, marginTop: 20, marginBottom: 16 }}>店舗を探す</h1>

        <form
          method="get"
          style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}
        >
          {/* region isn't its own dropdown here (only q / pref / category are),
              but it's preserved as a hidden field so links that arrive with a
              region filter (the region chips, the prefecture map) don't lose
              it when the visitor refines with a keyword or category. */}
          <input type="hidden" name="region" value={region} />
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
          <select
            name="pref"
            defaultValue={pref}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "1 1 160px",
            }}
          >
            <option value="">{prefFieldLabel}: すべて</option>
            {prefOptionsForRegion.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
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
            <option value="">カテゴリ: すべて</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn primary" style={{ fontSize: 13 }}>
            検索
          </button>
        </form>

        {(!stores || stores.length === 0) && (
          <p className="muted">条件に一致する店舗はありません。</p>
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
                await toggleFavoriteStore(s.id, "/stores");
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
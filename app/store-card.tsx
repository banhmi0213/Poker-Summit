import { StoreNamePlaceholder, StoreFallbackLogo, StoreDisplayName } from "@/app/store-name-placeholder";
import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/constants";

export function StoreCard({
  store,
  isFavorite,
  rank,
  favoriteAction,
  coverPhoto,
}: {
  store: {
    id: string;
    name: string;
    category: string | null;
    pref: string | null;
    city: string | null;
    description: string | null;
    logo_url?: string | null;
  };
  coverPhoto?: string;
  isFavorite: boolean;
  rank?: number;
  favoriteAction: () => Promise<void>;
}) {
  const desc = store.description ?? "";

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      {rank ? <div className={`store-rank-badge ${rank <= 3 ? `top${rank}` : ""}`}>{rank}位</div> : null}
      <form action={favoriteAction}>
        <button
          type="submit"
          className={`store-fav-btn ${isFavorite ? "active" : ""}`}
          aria-label="お気に入り"
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </form>
      <Link href={`/stores/${store.id}`} style={{ display: "block", color: "inherit" }}>
        <div className="generic-store-cover">{coverPhoto || store.logo_url ? <img src={coverPhoto || store.logo_url!} alt={`${store.name}の画像`} /> : <StoreNamePlaceholder name={store.name} />}</div>
        {!store.logo_url && <div className="generic-store-finger"><StoreFallbackLogo /></div>}
        <div style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}><StoreDisplayName name={store.name} /></div>
          {store.category && (
            <span className="badge" style={{ marginBottom: 6 }}>
              {CATEGORY_LABEL[store.category] ?? store.category}
            </span>
          )}
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            📍 {[store.pref, store.city].filter(Boolean).join(" ")}
          </div>
          {desc && (
            <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
              {desc.slice(0, 40)}
              {desc.length > 40 ? "…" : ""}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}

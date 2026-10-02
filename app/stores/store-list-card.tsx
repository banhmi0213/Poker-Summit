import Link from "next/link";
import { StoreCard } from "@/app/store-card";
import { CATEGORY_LABEL } from "@/lib/constants";

type Store = { id: string; name: string; category: string | null; pref: string | null; city: string | null; description: string | null; logo_url?: string | null };

export function StoreListCard({ store, coverPhoto, isFavorite, distanceKm, favoriteAction }: {
  store: Store; coverPhoto?: string; isFavorite: boolean; distanceKm?: number | null; favoriteAction: () => Promise<void>;
}) {
  return <>
    <div className="sl-card-mobile"><StoreCard store={store} isFavorite={isFavorite} favoriteAction={favoriteAction} /></div>
    <article className="sl-card-desktop">
      <form action={favoriteAction}><button type="submit" className={`store-fav-btn ${isFavorite ? "active" : ""}`} aria-label={`${store.name}をお気に入り${isFavorite ? "から解除" : "に追加"}`} aria-pressed={isFavorite}>{isFavorite ? "♥" : "♡"}</button></form>
      <Link href={`/stores/${store.id}`} style={{ display: "block", color: "inherit" }}>
        <div className="sl-card-cover">{coverPhoto ? <img src={coverPhoto} alt={`${store.name}の店舗写真`} /> : <span>POKER SUMMIT</span>}</div>
        <div className="sl-card-body">
          <div className="sl-card-logo">{store.logo_url ? <img src={store.logo_url} alt="" /> : "♠"}</div>
          <h3>{store.name}</h3>
          <p>📍 {[store.pref, store.city].filter(Boolean).join(" ")}</p>
          {store.category && <span className="badge">{CATEGORY_LABEL[store.category] ?? store.category}</span>}
          {distanceKm != null && <span className="sl-card-distance">{distanceKm.toFixed(1)} km</span>}
          <span className="sl-card-cta">店舗詳細を見る　→</span>
        </div>
      </Link>
    </article>
  </>;
}

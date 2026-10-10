import { StoreNamePlaceholder, StoreFallbackLogo, StoreDisplayName } from "@/app/store-name-placeholder";
import Link from "next/link";
import { StoreCard } from "@/app/store-card";
import { CATEGORY_LABEL } from "@/lib/constants";
import type { StoreDisplayFlags } from "@/lib/plan-entitlements";
import { VerifiedStoreBadge, goldFrameClass } from "@/app/store-plan-badge";

type Store = { id: string; name: string; category: string | null; pref: string | null; city: string | null; description: string | null; logo_url?: string | null; banner_url?: string | null };

export function StoreListCard({ store, coverPhoto, isFavorite, distanceKm, favoriteAction, flags }: {
  store: Store; coverPhoto?: string; isFavorite: boolean; distanceKm?: number | null; favoriteAction: () => Promise<void>; flags?: StoreDisplayFlags | null;
}) {
  const cover = store.banner_url || coverPhoto;
  return <>
    <div className="sl-card-mobile"><StoreCard store={store} isFavorite={isFavorite} favoriteAction={favoriteAction} coverPhoto={coverPhoto} flags={flags} /></div>
    <article className={`sl-card-desktop${goldFrameClass(flags)}`}>
      <form action={favoriteAction}><button type="submit" className={`store-fav-btn ${isFavorite ? "active" : ""}`} aria-label={`${store.name}をお気に入り${isFavorite ? "から解除" : "に追加"}`} aria-pressed={isFavorite}>{isFavorite ? "♥" : "♡"}</button></form>
      <Link href={`/stores/${store.id}`} style={{ display: "block", color: "inherit" }}>
        <div className="sl-card-cover">{cover ? <img loading="lazy" decoding="async" src={cover} alt={`${store.name}の店舗写真`} /> : <StoreNamePlaceholder name={store.name} />}</div>
        <div className="sl-card-body">
          <div className="sl-card-logo">{store.logo_url ? <img loading="lazy" decoding="async" src={store.logo_url} alt="" /> : <StoreFallbackLogo />}</div>
          <h3><StoreDisplayName name={store.name} /></h3>
          <p>📍 {[store.pref, store.city].filter(Boolean).join(" ")}</p>
          {store.category && <span className="badge">{CATEGORY_LABEL[store.category] ?? store.category}</span>}
          <VerifiedStoreBadge flags={flags} />
          {distanceKm != null && <span className="sl-card-distance">{distanceKm.toFixed(1)} km</span>}
          <span className="sl-card-cta">店舗詳細を見る　→</span>
        </div>
      </Link>
    </article>
  </>;
}

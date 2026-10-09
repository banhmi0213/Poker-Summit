import { StoreNamePlaceholder, StoreFallbackLogo, StoreDisplayName } from "@/app/store-name-placeholder";
import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/constants";
import type { StoreDisplayFlags } from "@/lib/plan-entitlements";
import { VerifiedStoreBadge, goldFrameClass } from "@/app/store-plan-badge";

export function HomeStoreCard({ store, coverPhoto, isFavorite, favoriteAction, rank, flags }: {
  store: { id: string; name: string; pref: string | null; city: string | null; category: string | null; logo_url?: string | null; banner_url?: string | null };
  coverPhoto?: string; isFavorite: boolean; favoriteAction: () => Promise<void>; rank?: number; flags?: StoreDisplayFlags | null;
}) {
  const cover = store.banner_url || coverPhoto;
  return <article className={`home-store-card${goldFrameClass(flags)}`}>
    <form action={favoriteAction}><button type="submit" className={`store-fav-btn ${isFavorite ? "active" : ""}`} aria-label={`${store.name}をお気に入り${isFavorite ? "から解除" : "に追加"}`} aria-pressed={isFavorite}>{isFavorite ? "♥" : "♡"}</button></form>
    <Link href={`/stores/${store.id}`}>
      <div className="home-store-photo">{cover ? <img src={cover} alt={`${store.name}の店舗写真`} loading="lazy" /> : <StoreNamePlaceholder name={store.name} />}{rank && <b className="home-rank">{rank}</b>}</div>
      <div className="home-store-copy">
        <div className="home-store-logo">{store.logo_url ? <img src={store.logo_url} alt="" loading="lazy" /> : <StoreFallbackLogo />}</div>
        <h3><StoreDisplayName name={store.name} /></h3><p className="home-location">📍 {[store.pref, store.city].filter(Boolean).join(" ")}</p>
        {store.category && <span className="home-tag">{CATEGORY_LABEL[store.category] ?? store.category}</span>}
        <VerifiedStoreBadge flags={flags} />
        <span className="home-card-cta">店舗詳細を見る <b>›</b></span>
      </div>
    </Link>
  </article>;
}

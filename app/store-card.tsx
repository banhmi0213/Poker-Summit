import { StoreNamePlaceholder, StoreFallbackLogo, StoreDisplayName } from "@/app/store-name-placeholder";
import Link from "next/link";
import type { StoreContentCounts } from "@/lib/store-content-counts";
import { CATEGORY_LABEL } from "@/lib/constants";
import type { StoreDisplayFlags } from "@/lib/plan-entitlements";
import { VerifiedStoreBadge, goldFrameClass } from "@/app/store-plan-badge";

export function StoreCard({
  store,
  isFavorite,
  rank,
  favoriteAction,
  coverPhoto,
  flags,
  contentCounts,
}: {
  store: {
    id: string;
    name: string;
    category: string | null;
    pref: string | null;
    city: string | null;
    description: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
  };
  coverPhoto?: string;
  isFavorite: boolean;
  rank?: number;
  favoriteAction: () => Promise<void>;
  flags?: StoreDisplayFlags | null;
  contentCounts?: StoreContentCounts;
}) {
  const desc = store.description ?? "";
  const cover = store.banner_url || coverPhoto;

  return (
    <div className={`card${goldFrameClass(flags)}`} style={{ padding: 0, overflow: "hidden", position: "relative" }}>
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
        <div className="generic-store-cover">{cover ? <img loading="lazy" decoding="async" src={cover} alt={`${store.name}の画像`} /> : <StoreNamePlaceholder name={store.name} />}</div>
        <div className="generic-store-finger">{store.logo_url ? <img loading="lazy" decoding="async" src={store.logo_url} alt="" /> : <StoreFallbackLogo />}</div>
        <div className={contentCounts ? "featured-store-card-body" : undefined} style={{ padding: 14 }}>
          <div className={contentCounts ? "featured-store-card-title" : undefined} style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}><StoreDisplayName name={store.name} /></div>
          {contentCounts ? (
            <>
              <div className="featured-store-card-location muted">📍 {[store.pref, store.city].filter(Boolean).join(" ")}</div>
              <div className="featured-store-card-meta">
                {store.category && <span className="badge">{CATEGORY_LABEL[store.category] ?? store.category}</span>}
                <span className="featured-store-card-cta">店舗詳細を見る ›</span>
              </div>
              <VerifiedStoreBadge flags={flags} />
            </>
          ) : (
            <>
              {store.category && <span className="badge" style={{ marginBottom: 6 }}>{CATEGORY_LABEL[store.category] ?? store.category}</span>}
              <VerifiedStoreBadge flags={flags} />
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>📍 {[store.pref, store.city].filter(Boolean).join(" ")}</div>
            </>
          )}
          {desc && !contentCounts && (
            <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
              {desc.slice(0, 40)}
              {desc.length > 40 ? "…" : ""}
            </p>
          )}
          {contentCounts && <div className="featured-store-counts" aria-label="店舗の掲載情報">
            {([["🏆", "大会", contentCounts.events], ["🎟", "特典", contentCounts.coupons], ["📢", "お知らせ", contentCounts.notices], ["💼", "求人", contentCounts.jobs]] as const).map(([icon, label, count]) => (
              <span className="featured-store-count" key={label}><span className="featured-store-count-value"><span aria-hidden="true">{icon}</span> {count}</span><span className="featured-store-count-label">{label}</span></span>
            ))}
          </div>}
        </div>
      </Link>
    </div>
  );
}

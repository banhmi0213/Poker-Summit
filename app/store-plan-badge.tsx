import type { StoreDisplayFlags } from "@/lib/plan-entitlements";

// 優良店バッジ(スタンダード・プレミアムを1か月以上継続している店舗)。
export function VerifiedStoreBadge({ flags }: { flags?: StoreDisplayFlags | null }) {
  if (!flags?.verifiedBadge) return null;
  return (
    <span className="verified-store-badge" title="1か月以上継続して掲載している店舗です">
      <span aria-hidden="true">★</span>優良店
    </span>
  );
}

/** プレミアムプランの店舗カードを金枠にするためのクラス名。 */
export function goldFrameClass(flags?: StoreDisplayFlags | null) {
  return flags?.goldFrame ? " store-gold-frame" : "";
}

import { PREF_REGION } from "./constants";

export const COUPON_CATEGORIES = [
  { value: "参加費割引", label: "参加費割引", description: "トーナメント参加費・施設利用料などの割引", x: 20 },
  { value: "ドリンク", label: "ドリンク特典", description: "ドリンク無料・割引などの特典", x: 732 },
  { value: "初回来店", label: "初回来店特典", description: "初めて来店する方限定の特典", x: 1448 },
  { value: "友達紹介", label: "友達紹介", description: "紹介者・紹介された方への特典（すべて見る・一覧の友達紹介に掲載）" },
] as const;

export function couponCategoryLabel(value: string | null | undefined) {
  return COUPON_CATEGORIES.find(c => c.value === value)?.label ?? value ?? "未設定";
}

export function requireCouponCategory(value: string) {
  if (!COUPON_CATEGORIES.some(c => c.value === value)) throw new Error("掲載カテゴリを選択してください。");
  return value;
}

export function couponCategoryHref(offerType: string, pref = "", area = "", region = "") {
  const params = new URLSearchParams();
  if (offerType) params.set("offerType", offerType);
  if (pref) params.set("pref", pref);
  if (pref && area) params.set("area", area);
  if (region) params.set("region", region);
  return `/coupons${params.size ? `?${params}` : ""}`;
}

export function matchesCouponLocation(store: { pref?: string; city?: string; address?: string } | null, pref: string, area: string, region: string) {
  if (pref && store?.pref !== pref) return false;
  if (!pref && region && !(PREF_REGION[store?.pref ?? ""] ?? []).includes(region)) return false;
  return !pref || !area || [store?.city, store?.address].some(v => v?.includes(area));
}

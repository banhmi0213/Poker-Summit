/** クーポンの使える回数（店ごとに選ぶ、2026/11/02）。DBの coupons.use_rule と同じ値。 */
export const COUPON_USE_RULES = ["once", "daily", "unlimited"] as const;
export type CouponUseRule = (typeof COUPON_USE_RULES)[number];

export const COUPON_USE_RULE_LABEL: Record<CouponUseRule, string> = {
  once: "お一人様1回",
  daily: "お一人様1日1回",
  unlimited: "何度でも",
};

export function parseCouponUseRule(value: unknown): CouponUseRule {
  const v = String(value ?? "").trim();
  return (COUPON_USE_RULES as readonly string[]).includes(v) ? (v as CouponUseRule) : "once";
}

/** 日本時間の今日（YYYY-MM-DD） */
export function jstToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** そのクーポンを今日もう使えないか（使用記録から判断） */
export function couponUsedUp(rule: CouponUseRule, usedDates: string[], today = jstToday()): boolean {
  if (rule === "unlimited") return false;
  if (rule === "daily") return usedDates.includes(today);
  return usedDates.length > 0;
}

// クーポンの有効期限(2026/10/18)。期限日(valid_until)の「その店舗の営業終了」まで使える。
// 営業終了の日時はデータベースが coupons.expires_at に自動で入れる
// (supabase/migrations/20261018120000_coupon_expires_at.sql。店舗の営業時間 → Googleの営業時間 → 24:00 の順)。
// 期限を過ぎたクーポンは一覧・店舗ページ・TOPに出さず、詳細ページでは「期限切れ」と表示して使えない。

const JST_MS = 9 * 60 * 60 * 1000;

type CouponExpiry = { valid_until: string | null; expires_at?: string | null };

/** 日本時間の今日 'YYYY-MM-DD' */
function jstToday(now: Date) {
  return new Date(now.getTime() + JST_MS).toISOString().slice(0, 10);
}

/** 期限切れか(営業終了の日時を過ぎたか)。expires_at が無い古いデータは期限日の24:00(日本時間)まで */
export function isCouponExpired(c: CouponExpiry, now: Date = new Date()): boolean {
  if (!c.valid_until) return false;
  if (c.expires_at) return Date.parse(c.expires_at) <= now.getTime();
  return c.valid_until < jstToday(now);
}

/** Supabase の .or() に渡す「期限切れでない」の条件 */
export function notExpiredFilter(now: Date = new Date()): string {
  return `valid_until.is.null,expires_at.is.null,expires_at.gt.${now.toISOString()}`;
}

/**
 * 表示用の有効期限。例: 「2026/10/30 23:00まで」「2026/10/30 24:00まで」「2026/10/30（翌3:00まで）」
 * sep は日付の区切り("/" や ".")
 */
export function couponExpiryLabel(c: CouponExpiry, sep = "/"): string | null {
  if (!c.valid_until) return null;
  const date = c.valid_until.replaceAll("-", sep);
  if (!c.expires_at) return `${date}まで`;
  const end = new Date(Date.parse(c.expires_at) + JST_MS);
  const endDate = end.toISOString().slice(0, 10);
  const hh = end.getUTCHours();
  const mm = String(end.getUTCMinutes()).padStart(2, "0");
  if (endDate === c.valid_until) return `${date} ${hh}:${mm}まで`;
  const nextDay = new Date(Date.parse(`${c.valid_until}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if (endDate === nextDay && hh === 0 && mm === "00") return `${date} 24:00まで`;
  return `${date}（翌${hh}:${mm}まで）`;
}

/** Very small user-agent sniffing, just enough to bucket page views into the
 * mobile/pc/tablet split shown on the admin analytics overview tab. Not meant
 * to be exhaustive — good enough to replace the prototype's hardcoded
 * deviceSplit demo numbers with something derived from real traffic. */
export function classifyDevice(userAgent: string | null): "mobile" | "tablet" | "pc" {
  if (!userAgent) return "pc";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android/.test(ua)) return "mobile";
  return "pc";
}

/**
 * 検索エンジンのクローラーやSNSのリンクプレビューなど、人ではないアクセスか(2026/10)。
 * 閲覧数(page_views)に数えないために使う。
 */
export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|headless|lighthouse|pagespeed|vercel|curl|wget|python-requests|axios|node-fetch|go-http-client/i.test(userAgent);
}

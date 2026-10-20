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

/**
 * SNSアプリの中のブラウザ(アプリ内ブラウザ)か。どのアプリかを返す(2026/10/20)。
 * Instagram・Facebook・LINE・X(Twitter)・TikTok のアプリ内ブラウザでは、ロボット確認などがうまく動かないことがある。
 */
export function inAppBrowser(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (/Instagram/i.test(userAgent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(userAgent)) return "facebook";
  if (/\bLine\//i.test(userAgent)) return "line";
  if (/Twitter|TwitterAndroid/i.test(userAgent)) return "x";
  if (/BytedanceWebview|musical_ly|TikTok/i.test(userAgent)) return "tiktok";
  return null;
}

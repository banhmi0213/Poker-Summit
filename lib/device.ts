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

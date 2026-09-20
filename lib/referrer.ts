const SEARCH_ENGINES = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu."];
const SOCIAL = ["facebook.", "twitter.", "x.com", "instagram.", "line.me", "t.co", "tiktok."];

/** Buckets a raw referrer URL into the same 4 categories the prototype's
 * (hardcoded) referrer breakdown used, but computed from real page_views.referrer
 * values instead of made-up percentages. */
export function classifyReferrer(referrer: string | null): "検索エンジン" | "SNS経由" | "直接アクセス" | "外部サイト・提携先" {
  if (!referrer) return "直接アクセス";
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "外部サイト・提携先";
  }
  if (host.includes("poker-summit")) return "直接アクセス";
  if (SEARCH_ENGINES.some((s) => host.includes(s))) return "検索エンジン";
  if (SOCIAL.some((s) => host.includes(s))) return "SNS経由";
  return "外部サイト・提携先";
}

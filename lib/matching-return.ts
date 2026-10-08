export type MatchingActor = "store" | "dealer";

export function matchingReturn(actor: MatchingActor, candidate?: string): string {
 const fallback = actor === "store" ? "/store/profile/spot-jobs" : "/spot-jobs";
 if (!candidate || candidate.length > 3000 || !candidate.startsWith("/") || candidate.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(candidate)) return fallback;
 try {
  const url = new URL(candidate, "https://pokersummit.jp");
  const pattern = actor === "store" ? /^\/store\/profile\/(?:spot-jobs\/work|spot-jobs|dealers|dealer-chat)(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i : /^(?:\/account\/dealer\/(?:work|chat)|\/spot-jobs)(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;
  if (url.origin !== "https://pokersummit.jp" || !pattern.test(url.pathname)) return fallback;
  const query = new URLSearchParams();
  for (const key of ["pref", "q", "game", "date", "page", "edit", "job", "record"]) {
   const value = url.searchParams.get(key);
   if (value !== null) query.set(key, value.slice(0, 200));
  }
  return url.pathname + (query.size ? "?" + query.toString() : "");
 } catch { return fallback; }
}

export function matchingReturnWithQuery(path: string, params: Record<string, string | undefined>): string {
 const query = new URLSearchParams();
 for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
 return path + (query.size ? "?" + query.toString() : "");
}

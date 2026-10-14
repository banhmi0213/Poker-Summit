export function loginDestination(value: string, kind: "member" | "store" | "admin"): string {
  const fallback = kind === "member" ? "/mypage" : kind === "store" ? "/store/profile" : "/admin/stores";
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://pokersummit.jp");
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://pokersummit.jp" || /[\\\u0000-\u0020]/.test(path) || path.startsWith("//")) return fallback;
    if (kind === "admin") return /^\/admin(?:\/|$)/.test(path) ? value : fallback;
    if (kind === "store") return /^\/store\/(?!login(?:\/|$))/.test(path) ? value : fallback;
    if (/^\/(?:admin(?:-login)?|store|api|login|signup)(?:\/|$)/.test(path)) return fallback;
    return value;
  } catch { return fallback; }
}

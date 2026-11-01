// 先行登録モード中に、インフルエンサー等へサイトの中身だけ見せるための「閲覧用パス」(2026/10)。
// 会員アカウントではないので、投稿・応募・お気に入り等はできず、会員数にも数えない。
// ログインIDとパスワードはVercelの環境変数 PREVIEW_LOGIN_ID / PREVIEW_PASSWORD に入れる
// (コードには書かない)。パスワードを変えると、それまでに入った人の閲覧も止まる。
export const PREVIEW_COOKIE = "ps_preview";

export function previewConfigured() {
  return !!process.env.PREVIEW_LOGIN_ID && !!process.env.PREVIEW_PASSWORD;
}

export function normalizePreviewId(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

/** Cookieに入れる合言葉(ID・パスワードから作る。パスワード自体は入れない) */
export async function previewToken(): Promise<string | null> {
  const id = process.env.PREVIEW_LOGIN_ID;
  const pw = process.env.PREVIEW_PASSWORD;
  if (!id || !pw) return null;
  const data = new TextEncoder().encode(`ps-preview:${normalizePreviewId(id)}:${pw}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hasPreviewAccess(cookieValue: string | undefined) {
  if (!cookieValue) return false;
  const token = await previewToken();
  return !!token && cookieValue === token;
}

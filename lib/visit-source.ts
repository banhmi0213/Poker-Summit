/**
 * 広告などのリンクに付けた目印(?utm_source=instagram&utm_campaign=store_test)を
 * 「instagram/store_test」の形にする(2026/10/21)。英数字・-_ だけ、60文字まで。
 */
export function visitSource(utmSource?: string | null, utmCampaign?: string | null): string | null {
  const clean = (v?: string | null) => (v ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  const s = clean(utmSource);
  const c = clean(utmCampaign);
  if (!s && !c) return null;
  return c ? `${s || "unknown"}/${c}` : s;
}

/** 「instagram/dealer_test」の形の目印をそのまま受け取ったときの確認(フォームの hidden から戻ってきた値など)。 */
export function cleanSource(raw?: string | null): string | null {
  const [s, c] = String(raw ?? "").split("/");
  return visitSource(s, c);
}

/**
 * 登録・ログイン後の戻り先として使ってよいサイト内のパスだけを通す(2026/10/21)。
 * 今は広告から来た人のディーラー登録だけに使う。
 */
export function safeNext(raw?: string | null): string | null {
  const v = String(raw ?? "");
  return /^\/account\/dealer(\/edit)?$/.test(v) ? v : null;
}

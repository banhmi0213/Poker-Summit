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

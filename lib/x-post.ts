/** Accept post URLs only; discard tracking parameters and never accept embed HTML. */
export function normalizeXPostUrl(value: string): string {
 const raw = value.trim();
 if (!raw) return "";
 if (raw.length > 2048) throw new Error("X投稿URLが長すぎます。");
 let url: URL;
 try { url = new URL(raw); } catch { throw new Error("X投稿のURLを入力してください。"); }
 const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/([1-9][0-9]{0,24})\/?$/);
 if (url.protocol !== "https:" || url.username || url.password || url.port || !["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"].includes(url.hostname) || !match) {
  throw new Error("https://x.com/アカウント名/status/投稿ID の形式で入力してください。");
 }
 return `https://x.com/${match[1]}/status/${match[2]}`;
}

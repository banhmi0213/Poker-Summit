// Cloudflare Turnstile(ロボット対策のチェック)のサーバー側検証(2026/10)。
// 環境変数 TURNSTILE_SECRET_KEY / NEXT_PUBLIC_TURNSTILE_SITE_KEY が未設定のあいだは
// チェックを省略する(設定するとすぐ有効になる)。

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export function turnstileEnabled() {
  return !!process.env.TURNSTILE_SECRET_KEY && !!TURNSTILE_SITE_KEY;
}

export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !TURNSTILE_SITE_KEY) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const json = (await res.json()) as { success?: boolean };
    return !!json.success;
  } catch {
    // Cloudflare側の障害で登録が全部止まらないよう、通信エラー時は通す
    return true;
  }
}

/** リクエスト元のIPアドレス(Vercel経由) */
export function clientIpFromHeaders(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return h.get("x-real-ip");
}

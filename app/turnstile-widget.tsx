import Script from "next/script";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

// ロボット確認(Cloudflare Turnstile)の表示。キー未設定の環境では何も出さない(2026/10)
export function TurnstileWidget({ note }: { note?: string }) {
  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language="ja" data-size="flexible" style={{ margin: "0 0 10px" }} />
      {note && <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>{note}</p>}
    </>
  );
}

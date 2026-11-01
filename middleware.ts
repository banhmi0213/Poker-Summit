import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { classifyScrape } from "@/lib/scrape-watch";
import { updateSession } from "@/lib/supabase/middleware";

const CANONICAL_HOST = "pokersummit.jp";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  watchScraping(request, event);
  // 本番の *.vercel.app でアクセスされたページは pokersummit.jp に寄せる(2026/10)。
  // 会員登録のロボット対策(Cloudflare Turnstile)は pokersummit.jp でしか動かないため。
  // プレビュー環境・API(cron/webhook)・ページ表示以外のリクエストはそのまま。
  const host = request.headers.get("host") ?? "";
  if (
    process.env.VERCEL_ENV === "production" &&
    host.endsWith(".vercel.app") &&
    (request.method === "GET" || request.method === "HEAD") &&
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }
  return await updateSession(request);
}

// スクレイピングの見張り(2026/10/30)。疑わしいページの読み込みを記録して運営にメールで知らせる。遮断はしない。
// 記録はページの表示を待たせない(waitUntil で後から送る)。
function watchScraping(request: NextRequest, event: NextFetchEvent) {
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const secret = process.env.CRON_SECRET;
  // ページだけを見る(API は サーバー同士の呼び出しが多く、誤検知になる)。
  if (!secret || request.nextUrl.pathname.startsWith("/api/")) return;
  const hit = classifyScrape(request.headers.get("user-agent"), {
    acceptLanguage: request.headers.get("accept-language"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
  if (!hit) return;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const body = JSON.stringify({ ...hit, ip, ua: request.headers.get("user-agent") ?? "", path: request.nextUrl.pathname + request.nextUrl.search });
  event.waitUntil(
    fetch(new URL("/api/security/scrape-hit", request.nextUrl.origin), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${secret}` }, body }).then(() => undefined, () => undefined),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)",
  ],
};

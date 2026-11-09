import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { classifyScrape, BLOCK_AT_ONCE } from "@/lib/scrape-watch";
import { updateSession } from "@/lib/supabase/middleware";
import { GTO_PATHS, POKER_GTO_ENABLED } from "@/lib/poker/features";

const CANONICAL_HOST = "pokersummit.jp";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const blocked = await watchScraping(request, event);
  if (blocked) return blocked;
  // 本番の *.vercel.app でアクセスされたページは pokersummit.jp に寄せる(2026/10)。
  // 会員登録のロボット対策(Cloudflare Turnstile)は pokersummit.jp でしか動かないため。
  // プレビュー環境・API(cron/webhook)・ページ表示以外のリクエストはそのまま。
  const host = request.headers.get("host") ?? "";
  if (
    process.env.VERCEL_ENV === "production" &&
    host.endsWith(".vercel.app") &&
    // 運営の確認用アドレス（11/5 公開前、lib/supabase/middleware.ts の staffHost）はそのまま見せる。
    host !== process.env.STAFF_PREVIEW_HOST &&
    (request.method === "GET" || request.method === "HEAD") &&
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }
  // GTO hidden (owner 2026/11/06, lib/poker/features.ts): its public pages go to the learning top.
  const path = request.nextUrl.pathname;
  if (!POKER_GTO_ENABLED && GTO_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/learn", request.url), 307);
  }
  return await updateSession(request);
}

// スクレイピングの見張りと遮断。2026/10/30 に記録とメール通知を始め、2026/11/02 から止めるようにした（オーナー指示：スクレイピングきたらすぐ止めなあかん）。
// AIの収集ロボット・プログラム/ツール・自動操作のブラウザ・名乗らないアクセスは最初の1回から 403。
// ブラウザらしくないアクセスも 2026/11/09 から最初の1回で止める（IPを分けて店舗ページを集める相手が来たため）。
// 普通のブラウザはここで何も問い合わせないので、表示は遅くならない。robots.txt はルールを確かめに来た相手なので見せる。
async function watchScraping(request: NextRequest, event: NextFetchEvent): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  // ページだけを見る(API は サーバー同士の呼び出しが多く、誤検知になる)。
  if (request.nextUrl.pathname.startsWith("/api/")) return null;
  const hit = classifyScrape(request.headers.get("user-agent"), {
    acceptLanguage: request.headers.get("accept-language"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
  if (!hit) return null;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const robots = request.nextUrl.pathname === "/robots.txt";
  const blocked = !robots && (BLOCK_AT_ONCE.includes(hit.category) || (await ipBlocked(ip)));
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const body = JSON.stringify({ ...hit, ip, blocked, ua: request.headers.get("user-agent") ?? "", path: request.nextUrl.pathname + request.nextUrl.search });
    event.waitUntil(
      fetch(new URL("/api/security/scrape-hit", request.nextUrl.origin), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${secret}` }, body }).then(() => undefined, () => undefined),
    );
  }
  return blocked ? new NextResponse("Forbidden", { status: 403, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }) : null;
}

async function ipBlocked(ip: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!ip || !url || !key) return false;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/scrape_ip_blocked`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ p_ip: ip }), signal: AbortSignal.timeout(1500) });
    return res.ok && (await res.json()) === true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)",
  ],
};

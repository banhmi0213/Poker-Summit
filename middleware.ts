import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const CANONICAL_HOST = "pokersummit.jp";

export async function middleware(request: NextRequest) {
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { classifyDevice, isBotUserAgent } from "@/lib/device";
import { getVisitorId } from "@/lib/visitor";
import { cleanSource } from "@/lib/visit-source";

// サイト全体の閲覧(PV・UU)の記録(2026/10/21、public.site_page_views)。
// app/ga-page-view.tsx がページを開くたびに送る。運営・クローラー・管理画面は数えない。
export const dynamic = "force-dynamic";
const EXCLUDE = /^\/(admin|admin-login|store\/|store$|api\/|auth\/|liff)/;

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent");
    if (isBotUserAgent(ua) || req.cookies.get("ps_staff")?.value === "1") return new NextResponse(null, { status: 204 });
    const body = (await req.json().catch(() => ({}))) as { path?: string; ref?: string; src?: string };
    const path = String(body.path ?? "").slice(0, 300);
    if (!path.startsWith("/") || EXCLUDE.test(path)) return new NextResponse(null, { status: 204 });
    // ログイン中の運営は数えない(セッションのCookieがあるときだけ確かめる)
    if (req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
      const supabase = await createClient();
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin === true) return new NextResponse(null, { status: 204 });
    }
    let referrer: string | null = String(body.ref ?? "").slice(0, 500) || null;
    if (referrer) {
      try {
        if (new URL(referrer).hostname.endsWith("pokersummit.jp")) referrer = null; // サイト内の移動は流入元にしない
      } catch {
        referrer = null;
      }
    }
    await createServiceRoleClient().from("site_page_views").insert({ path, visitor_id: getVisitorId(), referrer, device: classifyDevice(ua), source: cleanSource(body.src) });
  } catch {
    // 記録できなくても何もしない
  }
  return new NextResponse(null, { status: 204 });
}

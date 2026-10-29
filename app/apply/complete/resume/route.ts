import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSession } from "@/lib/komoju";

// 支払い画面で払わずに戻ってきた人を、同じKOMOJUのお支払い画面に戻す(2026/10/29)。
// 新しい決済は作らない。セッションがまだ支払い待ちのときだけそのURLへ。それ以外は戻り先(callback)で結果を確かめる。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const appId = req.nextUrl.searchParams.get("application") ?? "";
  const back = NextResponse.redirect(new URL(`/apply/complete/callback?application=${appId}`, origin), { status: 303 });
  if (!/^[0-9a-f-]{36}$/i.test(appId)) {
    return NextResponse.redirect(new URL(`/apply?error=${encodeURIComponent("申込みIDが見つかりません。")}`, origin), { status: 303 });
  }

  const svc = createServiceRoleClient();
  const { data: a } = await svc.from("listing_applications").select("id, payment_status").eq("id", appId).maybeSingle();
  if (!a || a.payment_status !== "charge_unknown") {
    return NextResponse.redirect(new URL(`/apply/complete?application=${appId}`, origin), { status: 303 });
  }

  const { data: attempt } = await svc
    .from("payment_attempts")
    .select("status, context")
    .eq("group_key", `apply:${appId}`)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sessionId = (attempt?.context as any)?.sessionId as string | undefined;
  if (!sessionId || attempt?.status !== "pending") return back;

  try {
    const session = (await getSession(sessionId)) as any;
    const status = String(session?.status ?? "").toLowerCase();
    if (status === "pending" && !session?.payment && typeof session?.session_url === "string") {
      return NextResponse.redirect(session.session_url, { status: 303 });
    }
  } catch {
    // KOMOJUに確かめられないときは、戻り先で結果を確かめる
  }
  return back;
}

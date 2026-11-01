import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { classifyDevice, isBotUserAgent } from "@/lib/device";

// 先行登録ページの離脱の計測(2026/10/19)。app/signup/funnel-tracker.tsx から送られる。
// page_views に path="/prelaunch#<event>" で記録し、総合管理 > アクセス統計 > 先行登録 で数える。
export const dynamic = "force-dynamic";

const EVENTS = new Set(["cta_click", "form_start", "submit"]);

export async function POST(req: NextRequest) {
  let event = "";
  try {
    event = String(((await req.json()) as { event?: unknown })?.event ?? "");
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const ua = req.headers.get("user-agent");
  if (!EVENTS.has(event) || isBotUserAgent(ua)) return new NextResponse(null, { status: 204 });
  // 同じサイトからの送信だけ受け付ける
  const origin = req.headers.get("origin") ?? "";
  if (origin && !/^https:\/\/(www\.)?pokersummit\.jp$/.test(origin) && !origin.endsWith(".vercel.app")) {
    return new NextResponse(null, { status: 204 });
  }
  try {
    await createServiceRoleClient().from("page_views").insert({ path: `/prelaunch#${event}`, referrer: null, device: classifyDevice(ua) });
  } catch {
    // 記録できなくても何もしない
  }
  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createNewsDrafts } from "@/lib/news-auto";
import { sendNewsDraftDigest } from "@/lib/email";

// ポーカーニュースの下書きを自動で作る(1日2回 Vercel Cron から呼ばれる、2026/10/23)。
// 1回に1本。作った下書きは運営にメールで知らせ、運営が確認してから公開する(lib/news-auto.ts)。
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await createNewsDrafts(1);
  const svc = createServiceRoleClient();
  await svc.from("audit_log").insert({ action: "news_drafts", target_type: "blog", detail: result });
  if (result.created.length) {
    const { data: settings } = await svc.from("site_settings").select("notify_email").eq("id", true).maybeSingle();
    if (settings?.notify_email) await sendNewsDraftDigest({ to: settings.notify_email, created: result.created }).catch(() => null);
  }
  return NextResponse.json(result);
}

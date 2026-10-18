import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendMemberDigestEmail } from "@/lib/email";
import { startCronRun, finishCronRun } from "@/lib/cron-run";

// ============================================================================
// 新規会員登録の1日1回まとめメール(2026/10/18、ユーザー指示「1日1回」)。
// 毎朝9:05(日本時間)に、前日(日本時間 0:00〜24:00)の新規会員を運営の通知先へ送る。
// 新規が0人の日は送らない。総合管理「サイト設定」の通知設定(notify_member_digest)で止められる。
// 店舗管理のログイン・運営アカウントは数えない。
// ============================================================================

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const runId = await startCronRun("member-digest");
  const svc = createServiceRoleClient();
  const JST = 9 * 3600 * 1000;
  const todayJst = new Date(Date.now() + JST).toISOString().slice(0, 10);
  const until = new Date(Date.parse(`${todayJst}T00:00:00+09:00`));
  const since = new Date(until.getTime() - 86_400_000);
  const day = new Date(since.getTime() + JST);
  const dayLabel = `${day.getUTCMonth() + 1}月${day.getUTCDate()}日`;
  try {
    const { data: settings } = await svc.from("site_settings").select("notify_email, notify_member_digest").eq("id", true).maybeSingle();
    if (!settings?.notify_member_digest || !settings.notify_email) {
      await finishCronRun(runId, "member-digest", { jobLabel: "新規会員のまとめメール", summary: { skipped: "通知オフまたは宛先なし" }, failures: [] });
      return NextResponse.json({ skipped: true });
    }
    const { data, error } = await svc.rpc("member_signup_digest", { p_since: since.toISOString(), p_until: until.toISOString() });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ email: string | null; created_at: string | null; confirmed: boolean | null; total_members: number }>;
    const members = rows
      .filter((r) => r.email && r.created_at)
      .map((r) => ({
        email: r.email as string,
        at: new Date(r.created_at as string).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }),
        confirmed: !!r.confirmed,
      }));
    const total = Number(rows[0]?.total_members ?? 0);
    if (members.length > 0) {
      await sendMemberDigestEmail({ to: settings.notify_email, dayLabel, members, total });
    }
    await finishCronRun(runId, "member-digest", { jobLabel: "新規会員のまとめメール", summary: { day: dayLabel, newMembers: members.length, total, sent: members.length > 0 }, failures: [] });
    return NextResponse.json({ day: dayLabel, newMembers: members.length, total });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await finishCronRun(runId, "member-digest", { jobLabel: "新規会員のまとめメール", summary: {}, failures: [{ step: "新規会員のまとめメール", detail }] });
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

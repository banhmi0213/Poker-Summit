import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveAndResume } from "@/lib/payment-resume";
import { startCronRun, finishCronRun, type CronFailure } from "@/lib/cron-run";

// ============================================================================
// KOMOJUの支払い画面(初回の申込み)の結果を確かめる自動処理(10分ごと、2026/10/19)。
// お客様が支払ったあと、サイトに戻らずに画面を閉じても、ここでKOMOJUに確かめて
// 決済済みなら店舗を発行する(何度動いても店舗は1つ・新たに決済はしない)。
// 支払われないまま24時間たったものは「決済されていない」で終える。
// 対象がある回だけ実行記録(決済の監視ページ)に残す。
// ============================================================================

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceRoleClient();
  const before = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data } = await svc
    .from("payment_attempts")
    .select("id, status")
    .eq("context->>hosted", "true")
    .in("status", ["pending", "unknown"])
    .lt("created_at", before)
    .order("created_at", { ascending: true })
    .limit(20);
  const rows = (data ?? []) as { id: string; status: string }[];
  if (rows.length === 0) return NextResponse.json({ checked: 0 });

  const runId = await startCronRun("payment-sessions");
  const failures: CronFailure[] = [];
  const results: Record<string, string> = {};
  for (const r of rows) {
    try {
      results[r.id] = (await resolveAndResume(r.id, null)).slice(0, 120);
    } catch (e) {
      failures.push({ step: "支払い画面の結果確認", id: r.id, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  await finishCronRun(runId, "payment-sessions", { jobLabel: "カード支払い画面の結果確認", summary: { checked: rows.length, ...results }, failures });
  return NextResponse.json({ checked: rows.length, failures: failures.length });
}

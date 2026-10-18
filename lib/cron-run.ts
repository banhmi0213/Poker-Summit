import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { alertAdmin } from "@/lib/admin-alert";

// 毎日の自動処理(cron)の実行記録(2026/10/18)。
// 結果は cron_runs に残り、総合管理 > 入金管理 > 決済の監視 で見られる。
// 失敗が1件でもあれば運営にメールで知らせる(以前は結果を返すだけで、誰も気づけなかった)。

export type CronFailure = { step: string; id?: string | null; detail: string };

export async function startCronRun(job: string): Promise<string | null> {
  const svc = createServiceRoleClient();
  const { data, error } = await svc.from("cron_runs").insert({ job }).select("id").single();
  if (error) console.error("[cron-run] start failed", job, error.message);
  return (data?.id as string | undefined) ?? null;
}

export async function finishCronRun(
  runId: string | null,
  job: string,
  params: { summary: Record<string, unknown>; failures: CronFailure[]; jobLabel: string }
): Promise<void> {
  const svc = createServiceRoleClient();
  const ok = params.failures.length === 0;
  if (!ok) console.error(`[cron:${job}] failures`, JSON.stringify(params.failures).slice(0, 4000));
  if (runId) {
    await svc
      .from("cron_runs")
      .update({ finished_at: new Date().toISOString(), ok, failures: params.failures.length, summary: params.summary, errors: params.failures.slice(0, 200) })
      .eq("id", runId);
  }
  if (!ok) {
    await alertAdmin(`自動処理「${params.jobLabel}」で${params.failures.length}件うまくいかないものがありました`, [
      `自動処理「${params.jobLabel}」の結果に、確認が必要なものがあります。`,
      "",
      ...params.failures.slice(0, 30).map((f) => `・${f.step}${f.id ? `（${f.id}）` : ""}: ${f.detail}`),
      params.failures.length > 30 ? `ほか ${params.failures.length - 30}件` : "",
    ]);
  }
}

/**
 * 自動処理が止まっていないかの見張り。ほかの自動処理から呼ぶ。
 * 指定の処理が maxHours 時間以上 正常に終わっていなければ運営に知らせる(1日1回まで)。
 */
export async function checkCronAlive(job: string, jobLabel: string, maxHours: number): Promise<CronFailure | null> {
  const svc = createServiceRoleClient();
  const { data } = await svc.from("cron_runs").select("started_at, finished_at").eq("job", job).not("finished_at", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null; // まだ記録が無い(導入直後)
  const ageH = (Date.now() - Date.parse(data.finished_at as string)) / 3_600_000;
  if (ageH <= maxHours) return null;
  return { step: "自動処理が止まっている可能性", id: job, detail: `「${jobLabel}」が${Math.floor(ageH)}時間 最後まで終わっていません(最後に終わった日時: ${new Date(data.finished_at as string).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })})` };
}

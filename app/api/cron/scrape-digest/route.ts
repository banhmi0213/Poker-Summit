import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { alertAdmin } from "@/lib/admin-alert";
import { startCronRun, finishCronRun } from "@/lib/cron-run";
import { SCRAPE_CATEGORY_LABEL, type ScrapeCategory } from "@/lib/scrape-watch";

// スクレイピングの毎朝のまとめ（オーナー 2026/11/04：メールが多すぎる。止めた分などは1日1回にまとめる）。
// 毎朝9:10(日本時間)に、前の24時間の自動アクセスを種類・相手ごとにまとめて運営の通知先へ送る。0件の日は送らない。
// すぐ知らせるのは、量が多くて新しくIPを止めたときだけ（app/api/security/scrape-hit）。
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const runId = await startCronRun("scrape-digest");
  const svc = createServiceRoleClient();
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: hits, error } = await svc.from("scrape_hits").select("ip,category,bot").gte("created_at", since).limit(20000);
    if (error) throw error;
    const rows = (hits ?? []) as { ip: string | null; category: ScrapeCategory; bot: string | null }[];
    const { data: blocks } = await svc.from("scrape_blocks").select("ip,reason,expires_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50);
    if (!rows.length) {
      await finishCronRun(runId, "scrape-digest", { jobLabel: "スクレイピングのまとめメール", summary: { hits: 0 }, failures: [] });
      return NextResponse.json({ ok: true, sent: false });
    }
    const groups = new Map<string, { label: string; bot: string; n: number; ips: Set<string> }>();
    for (const r of rows) {
      const key = `${r.category}|${r.bot ?? ""}`;
      const g = groups.get(key) ?? { label: SCRAPE_CATEGORY_LABEL[r.category] ?? r.category, bot: r.bot || "不明", n: 0, ips: new Set<string>() };
      g.n++; if (r.ip) g.ips.add(r.ip); groups.set(key, g);
    }
    const top = [...groups.values()].sort((a, b) => b.n - a.n).slice(0, 15);
    const lines = [
      `前の24時間に、自動のアクセスが ${rows.length.toLocaleString()} 件ありました（相手 ${groups.size} 種類）。`,
      "AIの収集ロボット・プログラム・自動操作のブラウザ・名乗らないアクセスは、最初から止めています。",
      "",
      "多い順：",
      ...top.map((g) => `・${g.label}：${g.bot}　${g.n}件（IP ${g.ips.size}個）`),
      "",
      blocks?.length ? `新しく止めたIPアドレス：${blocks.length}件` : "新しく止めたIPアドレス：なし",
      ...(blocks ?? []).slice(0, 10).map((b) => `・${b.ip}　${b.reason}`),
    ];
    const sent = await alertAdmin(`スクレイピングのまとめ（${rows.length.toLocaleString()}件）`, lines, "/admin/security");
    await finishCronRun(runId, "scrape-digest", { jobLabel: "スクレイピングのまとめメール", summary: { hits: rows.length, kinds: groups.size, blocked: blocks?.length ?? 0, sent }, failures: [] });
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    await finishCronRun(runId, "scrape-digest", { jobLabel: "スクレイピングのまとめメール", summary: {}, failures: [{ step: "まとめ", detail: e instanceof Error ? e.message : "失敗" }] });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// スクレイピングの記録と運営への通知(2026/10/30、オーナー指示：スクレイピングされたら速攻わかるように)。
// 止める判断は middleware（最初から止める種類）とここ（量が多いIPを止める）。
// middleware からだけ呼ぶ(CRON_SECRET 必須)。2026/11/09 からブラウザらしくないアクセスも middleware で最初から止めるので、
// ここで量を見てIPを止めるのは、止める種類から外れたものが来たときの予備。すぐのメールは新しくIPを止めたときだけ。
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { alertAdmin } from "@/lib/admin-alert";
import { SCRAPE_CATEGORY_LABEL, type ScrapeCategory } from "@/lib/scrape-watch";

export const dynamic = "force-dynamic";
const CATEGORIES = Object.keys(SCRAPE_CATEGORY_LABEL) as ScrapeCategory[];
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const category = body.category as ScrapeCategory;
  if (!CATEGORIES.includes(category)) return NextResponse.json({ ok: false }, { status: 400 });
  const hit = { p_ip: text(body.ip, 64), p_ua: text(body.ua, 400), p_path: text(body.path, 300), p_category: category, p_bot: text(body.bot, 80) };
  const svc = createServiceRoleClient();
  // robots.txt を読みに来ただけ＝ルールを確かめている行儀のいい相手。一覧には残すが知らせない（オーナー 2026/10/31）。
  if (hit.p_path.split("?")[0] === "/robots.txt") {
    const { error } = await svc.from("scrape_hits").insert({ ip: hit.p_ip, ua: hit.p_ua, path: hit.p_path, category, bot: hit.p_bot });
    return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
  }
  const { data, error } = await svc.rpc("record_scrape_hit", hit);
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  const result = data as { alert?: boolean; recent?: number } | null;
  let blocked = body.blocked === true, newlyBlocked = false;
  // ブラウザらしくないアクセスが多いとき（10分で30ページ以上）は、そのIPを7日間止める。
  if (!blocked && category === "no-browser" && (result?.recent ?? 0) >= 30 && hit.p_ip) {
    const { data: ok } = await svc.rpc("block_scrape_ip", { p_ip: hit.p_ip, p_reason: `${hit.p_bot || "不明"} 10分で${result?.recent ?? 0}ページ`, p_days: 7 });
    blocked = ok === true; newlyBlocked = blocked;
  }
  // すぐのメールは「量が多くて新しくIPを止めたとき」だけ（オーナー 2026/11/04：メールが多すぎる）。
  // 最初から断る種類（AI・ツール・自動ブラウザ・名乗らない）や止めていない少量のものは、毎朝のまとめ（/api/cron/scrape-digest）へ。
  if (newlyBlocked && result?.alert) {
    await alertAdmin(`スクレイピングの疑い（${SCRAPE_CATEGORY_LABEL[category]}：${hit.p_bot || "不明"}）`, [
      "サイトの情報を自動で集めている疑いのあるアクセスがありました。",
      "このIPアドレスからのアクセスは自動で止めました（7日間）。",
      "",
      `種類：${SCRAPE_CATEGORY_LABEL[category]}`,
      `名前：${hit.p_bot || "不明"}`,
      `IPアドレス：${hit.p_ip || "不明"}`,
      `見られたページ：${hit.p_path}`,
      `同じIPからの直近10分：${result.recent ?? 0}ページ`,
      `ユーザーエージェント：${hit.p_ua || "(なし)"}`,
      "",
      "ほかの自動アクセス（最初から断っているものなど）は、毎朝のまとめメールでお知らせします。一覧は管理画面の「スクレイピング監視」で見られます。",
    ], "/admin/security");
  }
  return NextResponse.json({ ok: true });
}

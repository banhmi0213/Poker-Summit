// スクレイピングの記録と運営への通知(2026/10/30、オーナー指示：スクレイピングされたら速攻わかるように)。
// middleware からだけ呼ぶ(CRON_SECRET 必須)。AI・ツール・自動ブラウザ・名乗らないアクセスは初回で、
// ブラウザらしくないアクセスは同じIPから10分で30ページ以上のときに、同じ相手は1時間に1回まで知らせる。
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
  const { data, error } = await svc.rpc("record_scrape_hit", hit);
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  const result = data as { alert?: boolean; recent?: number } | null;
  if (result?.alert) {
    await alertAdmin(`スクレイピングの疑い（${SCRAPE_CATEGORY_LABEL[category]}：${hit.p_bot || "不明"}）`, [
      "サイトの情報を自動で集めている疑いのあるアクセスがありました。",
      "",
      `種類：${SCRAPE_CATEGORY_LABEL[category]}`,
      `名前：${hit.p_bot || "不明"}`,
      `IPアドレス：${hit.p_ip || "不明"}`,
      `見られたページ：${hit.p_path}`,
      `同じIPからの直近10分：${result.recent ?? 0}ページ`,
      `ユーザーエージェント：${hit.p_ua || "(なし)"}`,
      "",
      "同じ相手のお知らせは1時間に1回までです。一覧は管理画面の「スクレイピング監視」で見られます。",
    ], "/admin/security");
  }
  return NextResponse.json({ ok: true });
}

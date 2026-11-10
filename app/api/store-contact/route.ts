// 店舗の連絡先(住所・電話番号・メール・SNS・Googleマップの場所)を、人が見ているページにだけ渡す(2026/11/10 オーナー：店舗情報が抜かれまくっている)。
// ページの中には連絡先を入れず、開いたあとにブラウザがここへ取りに来る。BotID で自動操作のブラウザと判定されたら渡さない。
import { NextResponse, type NextRequest } from "next/server";
import { checkBotId } from "botid/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 30;
const noStore = { "cache-control": "no-store", "x-robots-tag": "noindex" };

export async function POST(req: NextRequest) {
  let ids: string[] = [];
  try {
    const body = await req.json();
    ids = (Array.isArray(body?.ids) ? body.ids : [body?.id]).filter((v: unknown): v is string => typeof v === "string" && UUID.test(v));
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400, headers: noStore });
  }
  ids = Array.from(new Set(ids)).slice(0, MAX_IDS);
  if (!ids.length) return NextResponse.json({ error: "bad request" }, { status: 400, headers: noStore });
  // BotID の確認そのものが失敗したとき(設定の不具合など)は、普通の人に連絡先が出なくならないよう通す。記録は残す。
  let isBot = false;
  try {
    isBot = (await checkBotId()).isBot;
  } catch (e) {
    console.error("[store-contact] BotID check failed", e);
  }
  if (isBot) {
    const svc = createServiceRoleClient();
    // スクレイピング監視の一覧に残す(止めた記録)。失敗してもそのまま断る。
    await svc.from("scrape_hits").insert({ ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim(), ua: (req.headers.get("user-agent") ?? "").slice(0, 400), path: `/api/store-contact (${ids.length}店)`, category: "headless", bot: "BotID" }).then(() => undefined, () => undefined);
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }
  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("stores")
    .select("id,address,tel,email,line_url,x_url,instagram_url,google_place_id")
    .in("id", ids)
    .in("status", ["approved", "listed"]);
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  return NextResponse.json({ stores: data ?? [] }, { headers: noStore });
}

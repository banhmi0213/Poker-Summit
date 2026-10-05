import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// TOPバナースライダーの表示・クリック計測。ブラウザからnavigator.sendBeacon
// で送られてくる(クリック直後に画面遷移してもリクエストが途中で捨てられない
// ようにするため)。計測の失敗で表示や遷移を止めないよう、結果に関わらず204を
// 返す。banner_impressions/banner_clicksは誰でもINSERT可(RLS設定済み)。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bannerId = typeof body?.bannerId === "string" ? body.bannerId : "";
    const type = body?.type;
    if (UUID.test(bannerId) && (type === "impression" || type === "click")) {
      const supabase = await createClient();
      if (type === "impression") {
        await supabase.from("banner_impressions").insert({ banner_id: bannerId });
      } else {
        await supabase.from("banner_clicks").insert({
          banner_id: bannerId,
          referrer: request.headers.get("referer") ?? null,
        });
      }
    }
  } catch {
    // 計測失敗は無視する
  }
  return new NextResponse(null, { status: 204 });
}

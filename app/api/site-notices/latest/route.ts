import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

// 運営のサイトのお知らせのうち、いちばん新しいものの日時(ヘッダーの「お知らせ」の赤い点に使う、2026/10/20)。
// 30日より前のお知らせは「新しい」扱いにしない。誰が見ても同じなので短くキャッシュする。
export const revalidate = 60;

export async function GET() {
  const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const { data } = await createAnonClient()
    .from("site_notices")
    .select("created_at")
    .eq("published", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ latest: data?.created_at ?? null });
}

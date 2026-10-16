import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStoreClient } from "@/lib/supabase/store-server";

export const dynamic = "force-dynamic";

// 総合管理・店舗管理のメニューに出す「未対応・未確認の件数」(2026/10)。
// scope=admin → admin_attention_counts()(運営のみ)、scope=store → store_attention_counts()(店舗オーナーのみ)
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  if (scope !== "admin" && scope !== "store") return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  const db = scope === "store" ? await createStoreClient() : await createClient();
  const { data, error } = await db.rpc(scope === "store" ? "store_attention_counts" : "admin_attention_counts");
  return NextResponse.json(error ? {} : (data ?? {}), {
    status: error ? 503 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

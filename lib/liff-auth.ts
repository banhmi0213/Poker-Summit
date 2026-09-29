import { NextRequest, NextResponse } from "next/server";
import { verifyLiffIdToken } from "@/lib/line";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Shared entry check for every app/api/liff/* route (except /api/liff/link,
// which runs before a store is linked). Every route below authenticates a
// LINE user the same way the web portal authenticates a Supabase session:
// verify the bearer token, then resolve *that user's own* store — never a
// storeId taken from the request body/query, so a store can never read or
// write another store's data by guessing an id.
export async function authenticateLiffRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!idToken) {
    return {
      error: NextResponse.json({ error: "認証情報がありません。" }, { status: 401 }),
    } as const;
  }

  const verified = await verifyLiffIdToken(idToken);
  if (verified.error || !verified.userId) {
    return {
      error: NextResponse.json({ error: verified.error ?? "認証に失敗しました。" }, { status: 401 }),
    } as const;
  }

  const supabase = createServiceRoleClient();
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, status")
    .eq("line_user_id", verified.userId)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) } as const;
  }
  if (!store) {
    return {
      error: NextResponse.json(
        { error: "この端末はまだ店舗と連携されていません。運営から発行されたコードで連携してください。" },
        { status: 403 }
      ),
    } as const;
  }

  return {
    supabase,
    storeId: store.id as string,
    lineUserId: verified.userId as string,
  } as const;
}

export type LiffAuthResult = Awaited<ReturnType<typeof authenticateLiffRequest>>;

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyLiffIdToken } from "@/lib/line";
import { consumeStoreLinkCode } from "@/lib/store-update";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// One-time step: the store owner opens the LIFF app for the first time,
// enters the code the admin issued them (app/admin/stores -> "コード発行"),
// and this ties their LINE userId to that store row. Every other /api/liff/*
// route after this just resolves stores.line_user_id from the bearer token
// — no code is needed again.
export async function POST(req: NextRequest) {
  let body: { idToken?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { idToken, code } = body;
  if (!idToken || !code) {
    return NextResponse.json({ error: "IDトークンとコードを送信してください。" }, { status: 400 });
  }

  const verified = await verifyLiffIdToken(idToken);
  if (verified.error || !verified.userId) {
    return NextResponse.json({ error: verified.error ?? "認証に失敗しました。" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const result = await consumeStoreLinkCode(supabase, code, verified.userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // 総合管理画面の「LINE連携」列(未連携/連携済み)を即座に反映する。
  revalidatePath("/admin/stores");

  return NextResponse.json({ storeId: result.storeId });
}

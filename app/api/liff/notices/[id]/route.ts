import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";

const VALID_STATUSES = new Set(["published", "hidden"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const body = await req.json().catch(() => null);
  const updatePayload: Record<string, unknown> = {};

  if (body?.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "公開状態の値が不正です。" }, { status: 400 });
    }
    updatePayload.status = body.status;
  }
  if (body?.title !== undefined) {
    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "お知らせのタイトルを入力してください。" }, { status: 400 });
    }
    updatePayload.title = title;
  }
  if (body?.body !== undefined) updatePayload.body = body.body || null;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "更新内容がありません。" }, { status: 400 });
  }
  updatePayload.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("store_notices")
    .update(updatePayload)
    .eq("id", params.id)
    .eq("store_id", storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const { error } = await supabase
    .from("store_notices")
    .delete()
    .eq("id", params.id)
    .eq("store_id", storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  return NextResponse.json({ ok: true });
}

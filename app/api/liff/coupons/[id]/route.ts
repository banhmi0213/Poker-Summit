import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const body = await req.json().catch(() => null);
  const updatePayload: Record<string, unknown> = {};

  if (typeof body?.active === "boolean") {
    updatePayload.active = body.active;
  }
  if (body?.title !== undefined) {
    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "クーポンのタイトルを入力してください。" }, { status: 400 });
    }
    updatePayload.title = title;
  }
  if (body?.discount !== undefined) updatePayload.discount = body.discount || null;
  if (body?.description !== undefined) updatePayload.description = body.description || null;
  if (body?.code !== undefined) updatePayload.code = body.code || null;
  if (body?.validUntil !== undefined) updatePayload.valid_until = body.validUntil || null;
  if (body?.usageLimit !== undefined) {
    const n = body.usageLimit === "" || body.usageLimit == null ? null : parseInt(String(body.usageLimit), 10);
    updatePayload.usage_limit = Number.isFinite(n) ? n : null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "更新内容がありません。" }, { status: 400 });
  }

  const { error } = await supabase
    .from("coupons")
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
    .from("coupons")
    .delete()
    .eq("id", params.id)
    .eq("store_id", storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  return NextResponse.json({ ok: true });
}

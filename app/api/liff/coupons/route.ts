import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "クーポンのタイトルを入力してください。" }, { status: 400 });
  }

  const usageLimitRaw = body?.usageLimit;
  const usageLimit =
    usageLimitRaw === "" || usageLimitRaw == null ? null : parseInt(String(usageLimitRaw), 10);

  const { error } = await supabase.from("coupons").insert({
    store_id: storeId,
    title,
    discount: body?.discount || null,
    description: body?.description || null,
    code: body?.code || null,
    valid_until: body?.validUntil || null,
    usage_limit: Number.isFinite(usageLimit) ? usageLimit : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  return NextResponse.json({ ok: true }, { status: 201 });
}

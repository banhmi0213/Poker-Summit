import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("store_id", storeId)
    .order("posted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "求人タイトルを入力してください。" }, { status: 400 });
  }

  const { error } = await supabase.from("jobs").insert({
    store_id: storeId,
    title,
    job_type: body?.jobType || null,
    salary: body?.salary || null,
    description: body?.description || null,
    banner_image_url: body?.bannerImageUrl || null,
  });

  // プランの求人数上限(DBトリガー)に当たった場合は、その理由をそのまま返す
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "P0001" ? 400 : 500 });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  return NextResponse.json({ ok: true }, { status: 201 });
}

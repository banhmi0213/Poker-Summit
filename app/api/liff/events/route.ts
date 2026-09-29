import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("store_id", storeId)
    .order("start_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "イベント名を入力してください。" }, { status: 400 });
  }

  const { error } = await supabase.from("events").insert({
    store_id: storeId,
    title,
    location: body?.location || null,
    description: body?.description || null,
    start_at: body?.startAt || null,
    end_at: body?.endAt || null,
    category: body?.category || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  return NextResponse.json({ ok: true }, { status: 201 });
}

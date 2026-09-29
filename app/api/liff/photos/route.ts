import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { authenticateLiffRequest } from "@/lib/liff-auth";
import { recordStoreHistory } from "@/lib/store-update";

const PHOTOS_BUCKET = "store-photos";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

function extFromFile(file: File): string {
  const fromName = file.name?.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]{1,8}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = file.type?.split("/").pop();
  return fromType && /^[a-zA-Z0-9]{1,8}$/.test(fromType) ? fromType.toLowerCase() : "jpg";
}

export async function GET(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId } = auth;

  const { data, error } = await supabase
    .from("store_photos")
    .select("*")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: data ?? [] });
}

// LIFFの写真ライブラリ/カメラからのアップロードは multipart/form-data で届く。
export async function POST(req: NextRequest) {
  const auth = await authenticateLiffRequest(req);
  if ("error" in auth) return auth.error;
  const { supabase, storeId, lineUserId } = auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "画像を読み取れませんでした。" }, { status: 400 });
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "写真ファイルを選択してください。" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "画像ファイルを選択してください。" }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "写真のサイズが大きすぎます（8MBまで）。" }, { status: 400 });
  }

  const path = `${storeId}/${randomUUID()}.${extFromFile(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);

  const { data: inserted, error: insertError } = await supabase
    .from("store_photos")
    .insert({ store_id: storeId, url: publicUrl, storage_path: path })
    .select("id, url")
    .single();

  if (insertError) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await recordStoreHistory(supabase, {
    storeId,
    actorType: "line",
    actorLabel: `line:${lineUserId}`,
    field: "photo_added",
    oldValue: null,
    newValue: { id: inserted.id, url: inserted.url },
  });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);

  return NextResponse.json({ photo: inserted }, { status: 201 });
}

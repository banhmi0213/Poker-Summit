"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { recordStoreHistory } from "@/lib/store-update";

const PHOTOS_BUCKET = "store-photos";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

async function getOwnedStoreClient(storeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    throw new Error("この店舗を編集する権限がありません。");
  }

  return supabase;
}

function extFromFile(file: File): string {
  const fromName = file.name?.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]{1,8}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = file.type?.split("/").pop();
  return fromType && /^[a-zA-Z0-9]{1,8}$/.test(fromType) ? fromType.toLowerCase() : "jpg";
}

export async function uploadStorePhoto(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("写真ファイルを選択してください。");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください。");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("写真のサイズが大きすぎます（8MBまで）。");
  }

  const path = `${storeId}/${randomUUID()}.${extFromFile(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);

  const { data: inserted, error: insertError } = await supabase
    .from("store_photos")
    .insert({ store_id: storeId, url: publicUrl, storage_path: path })
    .select("id")
    .single();

  if (insertError) {
    // Roll back the uploaded object so a failed DB write doesn't leave an
    // orphaned file with nothing referencing it.
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    throw new Error(insertError.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await recordStoreHistory(supabase, {
    storeId,
    actorType: "web",
    actorLabel: `web:${user?.id ?? "unknown"}`,
    field: "photo_added",
    oldValue: null,
    newValue: { id: inserted?.id, url: publicUrl },
  });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
}

export async function deleteStorePhoto(photoId: string, storeId: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { data: photo, error: fetchError } = await supabase
    .from("store_photos")
    .select("id, url, storage_path")
    .eq("id", photoId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!photo) {
    throw new Error("写真が見つかりません。");
  }

  const { error: deleteRowError } = await supabase
    .from("store_photos")
    .delete()
    .eq("id", photoId)
    .eq("store_id", storeId);
  if (deleteRowError) {
    throw new Error(deleteRowError.message);
  }

  if (photo.storage_path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await recordStoreHistory(supabase, {
    storeId,
    actorType: "web",
    actorLabel: `web:${user?.id ?? "unknown"}`,
    field: "photo_deleted",
    oldValue: { id: photo.id, url: photo.url },
    newValue: null,
  });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
}

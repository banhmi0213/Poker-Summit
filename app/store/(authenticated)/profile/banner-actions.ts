"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { recordStoreHistory } from "@/lib/store-update";

// 店舗カード上部の看板画像(2026/10、「店舗管理画面に画像アップロードを
// ２つに」との指示。それまでは「ロゴ画像」1枚が看板とロゴ両方を兼ねて
// いたが、看板(店舗カード上部・約270×142px)とロゴ(左下の丸枠・約58×58px)
// を別々にアップロードできるようにした)。logo-actions.tsと同じく
// store-photos バケットの {storeId}/banner/{uuid}.ext に保存する。
// 看板は店舗につき1枚だけなので、新しい看板をアップロードしたら
// 古いファイルは削除する。
const PHOTOS_BUCKET = "store-photos";
const MAX_BANNER_BYTES = 8 * 1024 * 1024; // 8MB

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
    .select("id, banner_storage_path")
    .eq("id", storeId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    throw new Error("この店舗を編集する権限がありません。");
  }

  return { supabase, store };
}

function extFromFile(file: File): string {
  const fromName = file.name?.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]{1,8}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromType = file.type?.split("/").pop();
  return fromType && /^[a-zA-Z0-9]{1,8}$/.test(fromType) ? fromType.toLowerCase() : "jpg";
}

export async function uploadStoreBanner(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { supabase, store } = await getOwnedStoreClient(storeId);

  const file = formData.get("banner");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("看板画像ファイルを選択してください。");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください。");
  }
  if (file.size > MAX_BANNER_BYTES) {
    throw new Error("画像のサイズが大きすぎます（8MBまで）。");
  }

  const path = `${storeId}/banner/${randomUUID()}.${extFromFile(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);

  const oldPath = store.banner_storage_path;

  const { error: updateError } = await supabase
    .from("stores")
    .update({ banner_url: publicUrl, banner_storage_path: path })
    .eq("id", storeId);

  if (updateError) {
    // DBの更新に失敗したら、アップロードしたファイルだけが残らないようにする。
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    throw new Error(updateError.message);
  }

  if (oldPath) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([oldPath]);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await recordStoreHistory(supabase, {
    storeId,
    actorType: "web",
    actorLabel: `web:${user?.id ?? "unknown"}`,
    field: "banner_updated",
    oldValue: null,
    newValue: { url: publicUrl },
  });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/");
  revalidatePath("/stores");
}

export async function deleteStoreBanner(storeId: string) {
  const { supabase, store } = await getOwnedStoreClient(storeId);

  if (!store.banner_storage_path) {
    return;
  }

  const { error: updateError } = await supabase
    .from("stores")
    .update({ banner_url: null, banner_storage_path: null })
    .eq("id", storeId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await supabase.storage.from(PHOTOS_BUCKET).remove([store.banner_storage_path]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await recordStoreHistory(supabase, {
    storeId,
    actorType: "web",
    actorLabel: `web:${user?.id ?? "unknown"}`,
    field: "banner_removed",
    oldValue: null,
    newValue: null,
  });

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/");
  revalidatePath("/stores");
}

"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { uploadBannerImage, removeBannerImage } from "@/lib/store-banner-upload";

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
    .select("id, pref")
    .eq("id", storeId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    throw new Error("この店舗を編集する権限がありません。");
  }

  return { supabase, store };
}

export async function createNotice(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const { supabase, store } = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const imageFile = formData.get("image");

  if (!title) {
    throw new Error("お知らせのタイトルを入力してください。");
  }

  // 画像アップロード欄(2026/10、「お知らせに画像アップロード欄追加」との
  // 指示)。求人・クーポンのバナー画像と同じ共通処理を使う。
  let imageUrl: string | null = null;
  let imageStoragePath: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "notices", imageFile);
    imageUrl = uploaded.url;
    imageStoragePath = uploaded.path;
  }

  // /news(地域別に自動振り分けされる公開お知らせ一覧)用に、店舗の都道府県
  // (pref)をここで非正規化してコピーしておく(2026/10)。events テーブルと
  // 同じパターン。
  const { error } = await supabase.from("store_notices").insert({
    store_id: storeId,
    title,
    body: body || null,
    pref: store.pref,
    image_url: imageUrl,
    image_storage_path: imageStoragePath,
  });

  if (error) {
    if (imageStoragePath) {
      await removeBannerImage(supabase, imageStoragePath);
    }
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/news");
}

export async function updateNotice(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const noticeId = String(formData.get("noticeId") ?? "");
  const { supabase } = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const imageFile = formData.get("image");
  const removeImage = formData.get("removeImage") === "on";

  if (!title) {
    throw new Error("お知らせのタイトルを入力してください。");
  }

  const { data: current } = await supabase
    .from("store_notices")
    .select("image_storage_path")
    .eq("id", noticeId)
    .eq("store_id", storeId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    title,
    body: body || null,
    updated_at: new Date().toISOString(),
  };

  let oldPathToRemove: string | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "notices", imageFile);
    updates.image_url = uploaded.url;
    updates.image_storage_path = uploaded.path;
    oldPathToRemove = current?.image_storage_path ?? null;
  } else if (removeImage) {
    updates.image_url = null;
    updates.image_storage_path = null;
    oldPathToRemove = current?.image_storage_path ?? null;
  }

  const { error } = await supabase
    .from("store_notices")
    .update(updates)
    .eq("id", noticeId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (oldPathToRemove) {
    await removeBannerImage(supabase, oldPathToRemove);
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/news");
}

export async function toggleNoticeStatus(noticeId: string, storeId: string, status: string) {
  const { supabase } = await getOwnedStoreClient(storeId);

  const { error } = await supabase
    .from("store_notices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", noticeId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/news");
}

export async function deleteNotice(noticeId: string, storeId: string) {
  const { supabase } = await getOwnedStoreClient(storeId);

  const { data: current } = await supabase
    .from("store_notices")
    .select("image_storage_path")
    .eq("id", noticeId)
    .eq("store_id", storeId)
    .maybeSingle();

  const { error } = await supabase
    .from("store_notices")
    .delete()
    .eq("id", noticeId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (current?.image_storage_path) {
    await removeBannerImage(supabase, current.image_storage_path);
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/news");
}

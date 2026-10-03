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
    .select("id")
    .eq("id", storeId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    throw new Error("この店舗を編集する権限がありません。");
  }

  return supabase;
}

export async function createMenuItem(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const name = String(formData.get("name") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageFile = formData.get("image");

  if (!name) {
    throw new Error("項目名を入力してください。");
  }
  if (!price) {
    throw new Error("料金を入力してください。");
  }

  // 画像アップロード欄(2026/10、「料金・メニューに画像アップロード欄追加」
  // との指示)。求人・クーポンのバナー画像と同じ共通処理を使う。
  let imageUrl: string | null = null;
  let imageStoragePath: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "menu", imageFile);
    imageUrl = uploaded.url;
    imageStoragePath = uploaded.path;
  }

  const { error } = await supabase.from("store_menu_items").insert({
    store_id: storeId,
    name,
    price,
    description: description || null,
    image_url: imageUrl,
    image_storage_path: imageStoragePath,
  });

  if (error) {
    if (imageStoragePath) {
      await removeBannerImage(supabase, imageStoragePath);
    }
    throw new Error(error.message);
  }

  revalidatePath("/store/profile/menu");
  revalidatePath(`/stores/${storeId}`);
}

export async function updateMenuItem(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const name = String(formData.get("name") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageFile = formData.get("image");
  const removeImage = formData.get("removeImage") === "on";

  if (!name) {
    throw new Error("項目名を入力してください。");
  }
  if (!price) {
    throw new Error("料金を入力してください。");
  }

  const { data: current } = await supabase
    .from("store_menu_items")
    .select("image_storage_path")
    .eq("id", itemId)
    .eq("store_id", storeId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    name,
    price,
    description: description || null,
    updated_at: new Date().toISOString(),
  };

  let oldPathToRemove: string | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "menu", imageFile);
    updates.image_url = uploaded.url;
    updates.image_storage_path = uploaded.path;
    oldPathToRemove = current?.image_storage_path ?? null;
  } else if (removeImage) {
    updates.image_url = null;
    updates.image_storage_path = null;
    oldPathToRemove = current?.image_storage_path ?? null;
  }

  const { error } = await supabase
    .from("store_menu_items")
    .update(updates)
    .eq("id", itemId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (oldPathToRemove) {
    await removeBannerImage(supabase, oldPathToRemove);
  }

  revalidatePath("/store/profile/menu");
  revalidatePath(`/stores/${storeId}`);
}

export async function toggleMenuItemStatus(itemId: string, storeId: string, status: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { error } = await supabase
    .from("store_menu_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile/menu");
  revalidatePath(`/stores/${storeId}`);
}

export async function deleteMenuItem(itemId: string, storeId: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { data: current } = await supabase
    .from("store_menu_items")
    .select("image_storage_path")
    .eq("id", itemId)
    .eq("store_id", storeId)
    .maybeSingle();

  const { error } = await supabase
    .from("store_menu_items")
    .delete()
    .eq("id", itemId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (current?.image_storage_path) {
    await removeBannerImage(supabase, current.image_storage_path);
  }

  revalidatePath("/store/profile/menu");
  revalidatePath(`/stores/${storeId}`);
}

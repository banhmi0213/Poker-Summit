"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  if (!name) {
    throw new Error("項目名を入力してください。");
  }
  if (!price) {
    throw new Error("料金を入力してください。");
  }

  const { error } = await supabase.from("store_menu_items").insert({
    store_id: storeId,
    name,
    price,
    description: description || null,
  });

  if (error) {
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

  if (!name) {
    throw new Error("項目名を入力してください。");
  }
  if (!price) {
    throw new Error("料金を入力してください。");
  }

  const { error } = await supabase
    .from("store_menu_items")
    .update({
      name,
      price,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
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

  const { error } = await supabase
    .from("store_menu_items")
    .delete()
    .eq("id", itemId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile/menu");
  revalidatePath(`/stores/${storeId}`);
}

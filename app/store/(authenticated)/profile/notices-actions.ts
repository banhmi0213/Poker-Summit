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

export async function createNotice(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title) {
    throw new Error("お知らせのタイトルを入力してください。");
  }

  const { error } = await supabase.from("store_notices").insert({
    store_id: storeId,
    title,
    body: body || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
}

export async function updateNotice(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const noticeId = String(formData.get("noticeId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title) {
    throw new Error("お知らせのタイトルを入力してください。");
  }

  const { error } = await supabase
    .from("store_notices")
    .update({ title, body: body || null, updated_at: new Date().toISOString() })
    .eq("id", noticeId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
}

export async function toggleNoticeStatus(noticeId: string, storeId: string, status: string) {
  const supabase = await getOwnedStoreClient(storeId);

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
}

export async function deleteNotice(noticeId: string, storeId: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { error } = await supabase
    .from("store_notices")
    .delete()
    .eq("id", noticeId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
}

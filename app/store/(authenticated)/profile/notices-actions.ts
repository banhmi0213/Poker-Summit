"use server";

import { revalidatePath } from "next/cache";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";

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

  if (!title) {
    throw new Error("お知らせのタイトルを入力してください。");
  }

  // /news(地域別に自動振り分けされる公開お知らせ一覧)用に、店舗の都道府県
  // (pref)をここで非正規化してコピーしておく(2026/10)。events テーブルと
  // 同じパターン。
  const { error } = await supabase.from("store_notices").insert({
    store_id: storeId,
    title,
    body: body || null,
    pref: store.pref,
  });

  if (error) {
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
  revalidatePath("/news");
}

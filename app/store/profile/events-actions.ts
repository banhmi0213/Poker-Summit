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

export async function createEvent(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "").trim();
  const endAt = String(formData.get("endAt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!title) {
    throw new Error("イベント名を入力してください。");
  }

  const { error } = await supabase.from("events").insert({
    store_id: storeId,
    title,
    location: location || null,
    description: description || null,
    start_at: startAt || null,
    end_at: endAt || null,
    category: category || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

export async function toggleEventStatus(
  eventId: string,
  storeId: string,
  status: string
) {
  const supabase = await getOwnedStoreClient(storeId);

  const { error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

export async function updateEvent(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "").trim();
  const endAt = String(formData.get("endAt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!title) {
    throw new Error("イベント名を入力してください。");
  }

  const { error } = await supabase
    .from("events")
    .update({
      title,
      location: location || null,
      description: description || null,
      start_at: startAt || null,
      end_at: endAt || null,
      category: category || null,
    })
    .eq("id", eventId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

export async function deleteEvent(eventId: string, storeId: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

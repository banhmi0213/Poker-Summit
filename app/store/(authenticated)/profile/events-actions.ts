"use server";

import { parseEventDates } from "@/lib/event-dates";

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

export async function createEvent(formData: FormData) {
  const storeId = String(formData.get("storeId") ?? "");
  const supabase = await getOwnedStoreClient(storeId);

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "").trim();
  const endAt = String(formData.get("endAt") ?? "").trim();
  const eventDates = parseEventDates(startAt,endAt);
  const category = String(formData.get("category") ?? "").trim();
  const bannerFile = formData.get("bannerImage");

  if (!title) {
    throw new Error("トーナメント・イベント名を入力してください。");
  }

  let bannerImageUrl: string | null = null;
  let bannerStoragePath: string | null = null;
  if (bannerFile instanceof File && bannerFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "events", bannerFile);
    bannerImageUrl = uploaded.url;
    bannerStoragePath = uploaded.path;
  }

  const { error } = await supabase.from("events").insert({
    store_id: storeId,
    title,
    location: location || null,
    description: description || null,
    start_at: eventDates.start_at,
    end_at: eventDates.end_at,
    category: category || null,
    banner_image_url: bannerImageUrl,
    banner_storage_path: bannerStoragePath,
  });

  if (error) {
    if (bannerStoragePath) {
      await removeBannerImage(supabase, bannerStoragePath);
    }
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/events");
  revalidatePath("/events", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
}

export async function toggleEventStatus(eventId: string, storeId: string, status: string) {
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
  revalidatePath("/store/profile/events");
  revalidatePath("/events", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
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
  const eventDates = parseEventDates(startAt,endAt);
  const category = String(formData.get("category") ?? "").trim();
  const bannerFile = formData.get("bannerImage");
  const removeBanner = formData.get("removeBanner") === "on";

  if (!title) {
    throw new Error("トーナメント・イベント名を入力してください。");
  }

  const { data: current } = await supabase
    .from("events")
    .select("banner_storage_path")
    .eq("id", eventId)
    .eq("store_id", storeId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    title,
    location: location || null,
    description: description || null,
    start_at: eventDates.start_at,
    end_at: eventDates.end_at,
    category: category || null,
  };

  let oldPathToRemove: string | null = null;

  if (bannerFile instanceof File && bannerFile.size > 0) {
    const uploaded = await uploadBannerImage(supabase, storeId, "events", bannerFile);
    updates.banner_image_url = uploaded.url;
    updates.banner_storage_path = uploaded.path;
    oldPathToRemove = current?.banner_storage_path ?? null;
  } else if (removeBanner) {
    updates.banner_image_url = null;
    updates.banner_storage_path = null;
    oldPathToRemove = current?.banner_storage_path ?? null;
  }

  const { error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (oldPathToRemove) {
    await removeBannerImage(supabase, oldPathToRemove);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/events");
  revalidatePath("/events", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
}

export async function deleteEvent(eventId: string, storeId: string) {
  const supabase = await getOwnedStoreClient(storeId);

  const { data: current } = await supabase
    .from("events")
    .select("banner_storage_path")
    .eq("id", eventId)
    .eq("store_id", storeId)
    .maybeSingle();

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  if (current?.banner_storage_path) {
    await removeBannerImage(supabase, current.banner_storage_path);
  }

  revalidatePath("/store/profile");
  revalidatePath("/store/profile/events");
  revalidatePath("/events", "layout");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
}

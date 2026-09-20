"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setEventStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `event_status_${status}`, "event", id);
  revalidatePath("/admin/events");
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "event_delete", "event", id);
  revalidatePath("/admin/events");
}

export async function createEventByAdmin(formData: FormData) {
  const supabase = await createClient();

  const storeId = String(formData.get("storeId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "").trim();
  const endAt = String(formData.get("endAt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();

  if (!title) {
    throw new Error("イベント名を入力してください。");
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      store_id: storeId || null,
      title,
      location: location || null,
      description: description || null,
      start_at: startAt || null,
      end_at: endAt || null,
      category: category || null,
      pref: pref || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "event_create", "event", data?.id, { title });
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

export async function updateEventByAdmin(formData: FormData) {
  const supabase = await createClient();
  const eventId = String(formData.get("eventId") ?? "");

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startAt = String(formData.get("startAt") ?? "").trim();
  const endAt = String(formData.get("endAt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();

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
      pref: pref || null,
    })
    .eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "event_edit", "event", eventId);
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

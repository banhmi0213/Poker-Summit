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

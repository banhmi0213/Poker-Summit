"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setJobStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `job_status_${status}`, "job", id);
  revalidatePath("/admin/jobs");
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "job_delete", "job", id);
  revalidatePath("/admin/jobs");
}

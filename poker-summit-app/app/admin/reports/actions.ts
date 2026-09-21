"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setReportStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `report_${status}`, "report", id);
  revalidatePath("/admin/reports");
}

export async function deleteReport(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("reports").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "report_delete", "report", id);
  revalidatePath("/admin/reports");
}

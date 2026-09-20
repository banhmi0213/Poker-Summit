"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function updateSiteSettings(formData: FormData) {
  const supabase = await createClient();

  const siteName = String(formData.get("siteName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const maintenanceMode = formData.get("maintenanceMode") === "on";

  if (!siteName) {
    throw new Error("サイト名を入力してください。");
  }

  const { error } = await supabase
    .from("site_settings")
    .update({
      site_name: siteName,
      contact_email: contactEmail || null,
      maintenance_mode: maintenanceMode,
    })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "settings_update", "site_settings", undefined, {
    siteName,
    maintenanceMode,
  });

  revalidatePath("/admin/settings");
}

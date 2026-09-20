"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function updateSiteSettings(formData: FormData) {
  const supabase = await createClient();

  const siteName = String(formData.get("siteName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const announcement = String(formData.get("announcement") ?? "").trim();

  if (!siteName) {
    throw new Error("サイト名を入力してください。");
  }

  const { error } = await supabase
    .from("site_settings")
    .update({
      site_name: siteName,
      contact_email: contactEmail || null,
      announcement: announcement || null,
    })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "settings_update_basic", "site_settings", undefined, {
    siteName,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function updateListingSettings(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("site_settings")
    .update({
      listing_accept_new: formData.get("listingAcceptNew") === "1",
      listing_require_review: formData.get("listingRequireReview") === "1",
      listing_instant_update: formData.get("listingInstantUpdate") === "1",
      listing_expiry_notify: formData.get("listingExpiryNotify") === "1",
      report_auto_hide_count: String(formData.get("reportAutoHideCount") ?? "3件"),
    })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "settings_update_listing", "site_settings");
  revalidatePath("/admin/settings");
}

export async function updateNotifySettings(formData: FormData) {
  const supabase = await createClient();

  const notifyEmail = String(formData.get("notifyEmail") ?? "").trim();

  const { error } = await supabase
    .from("site_settings")
    .update({
      notify_email: notifyEmail || null,
      notify_new_listing: formData.get("notifyNewListing") === "1",
      notify_new_report: formData.get("notifyNewReport") === "1",
      notify_inquiry: formData.get("notifyInquiry") === "1",
      notify_banner_anomaly: formData.get("notifyBannerAnomaly") === "1",
      auto_notify_listing_result: formData.get("autoNotifyListingResult") === "1",
      auto_notify_important: formData.get("autoNotifyImportant") === "1",
      notify_start_hour: String(formData.get("notifyStartHour") ?? "9:00"),
      notify_end_hour: String(formData.get("notifyEndHour") ?? "22:00"),
    })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "settings_update_notify", "site_settings");
  revalidatePath("/admin/settings");
}

export async function updateMaintenanceSettings(formData: FormData) {
  const supabase = await createClient();

  const maintenanceMode = formData.get("maintenanceMode") === "1";
  const maintenanceStart = String(formData.get("maintenanceStart") ?? "").trim();
  const maintenanceEnd = String(formData.get("maintenanceEnd") ?? "").trim();
  const maintenanceMessage = String(formData.get("maintenanceMessage") ?? "").trim();
  const maintenanceAllowedIps = String(formData.get("maintenanceAllowedIps") ?? "").trim();

  const { error } = await supabase
    .from("site_settings")
    .update({
      maintenance_mode: maintenanceMode,
      maintenance_start: maintenanceStart || null,
      maintenance_end: maintenanceEnd || null,
      maintenance_message: maintenanceMessage || null,
      maintenance_allowed_ips: maintenanceAllowedIps || null,
    })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(
    supabase,
    maintenanceMode ? "settings_maintenance_on" : "settings_maintenance_off",
    "site_settings"
  );
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

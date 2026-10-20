"use server";

import { revalidateTag } from "next/cache";
import { revalidatePath, revalidatePublicData } from "@/lib/revalidate";
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
  revalidatePublicData();
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
      notify_member_digest: formData.get("notifyMemberDigest") === "1",
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
  revalidatePublicData();
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

/** 先行登録モード(ONの間は一般向けページを先行会員登録の案内に差し替える。反映は最大30秒) */
export async function updatePrelaunchSettings(formData: FormData) {
  const supabase = await createClient();
  const prelaunchMode = formData.get("prelaunchMode") === "1";
  // 先行会員にサイトを公開(ディーラーマッチングは閉じたまま、2026/10/20)
  const memberPreview = formData.get("memberPreview") === "1";
  const prelaunchMessage = String(formData.get("prelaunchMessage") ?? "").trim();
  const prelaunchXUrl = String(formData.get("prelaunchXUrl") ?? "").trim();
  if (prelaunchXUrl && !/^https:\/\/(x|twitter)\.com\//.test(prelaunchXUrl)) {
    throw new Error("公式XのURLは https://x.com/ から始まる形で入力してください。");
  }
  const { error } = await supabase
    .from("site_settings")
    .update({
      prelaunch_mode: prelaunchMode,
      member_preview: memberPreview,
      prelaunch_message: prelaunchMessage || null,
      prelaunch_x_url: prelaunchXUrl || null,
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, prelaunchMode ? "settings_prelaunch_on" : "settings_prelaunch_off", "site_settings", undefined, { memberPreview });
  revalidatePath("/admin/settings");
  revalidatePath("/prelaunch");
}

// 年内お申込み特典(料金据え置き)の表示と受付期限(2026/10)
export async function updatePriceLockSettings(formData: FormData) {
  const supabase = await createClient();
  const enabled = formData.get("priceLockEnabled") === "1";
  const deadlineDate = String(formData.get("priceLockDeadline") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) throw new Error("受付期限の日付を正しく入力してください。");
  const { error } = await supabase
    .from("site_settings")
    .update({ price_lock_campaign_enabled: enabled, price_lock_deadline: `${deadlineDate}T23:59:59+09:00` })
    .eq("id", true);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, enabled ? "settings_price_lock_on" : "settings_price_lock_off", "site_settings");
  revalidateTag("price-lock-campaign");
  revalidatePath("/admin/settings");
  revalidatePath("/apply");
  revalidatePath("/terms");
  revalidatePath("/tokushoho");
}

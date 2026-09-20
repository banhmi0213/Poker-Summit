"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setCouponActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ active }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, active ? "coupon_activate" : "coupon_deactivate", "coupon", id);
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "coupon_delete", "coupon", id);
  revalidatePath("/admin/coupons");
}

export async function createCouponByAdmin(formData: FormData) {
  const supabase = await createClient();

  const storeId = String(formData.get("storeId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const discount = String(formData.get("discount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const usageLimitRaw = String(formData.get("usageLimit") ?? "").trim();
  const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;

  if (!storeId) {
    throw new Error("店舗を選択してください。");
  }
  if (!title) {
    throw new Error("クーポンのタイトルを入力してください。");
  }

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      store_id: storeId,
      title,
      discount: discount || null,
      description: description || null,
      code: code || null,
      valid_until: validUntil || null,
      usage_limit: usageLimit,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "coupon_create", "coupon", data?.id, { storeId, title });
  revalidatePath("/admin/coupons");
}

export async function updateCouponByAdmin(formData: FormData) {
  const supabase = await createClient();
  const couponId = String(formData.get("couponId") ?? "");

  const title = String(formData.get("title") ?? "").trim();
  const discount = String(formData.get("discount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const usageLimitRaw = String(formData.get("usageLimit") ?? "").trim();
  const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;

  if (!title) {
    throw new Error("クーポンのタイトルを入力してください。");
  }

  const { error } = await supabase
    .from("coupons")
    .update({
      title,
      discount: discount || null,
      description: description || null,
      code: code || null,
      valid_until: validUntil || null,
      usage_limit: usageLimit,
    })
    .eq("id", couponId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "coupon_edit", "coupon", couponId);
  revalidatePath("/admin/coupons");
}

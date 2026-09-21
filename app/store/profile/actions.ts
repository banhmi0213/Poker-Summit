"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateStoreProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const storeId = String(formData.get("storeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "");
  const tel = String(formData.get("tel") ?? "");
  const hours = String(formData.get("hours") ?? "");
  const description = String(formData.get("description") ?? "");
  const lineUrl = String(formData.get("lineUrl") ?? "").trim();
  const areaKeywords = String(formData.get("areaKeywords") ?? "").trim();

  if (!name) {
    throw new Error("店舗名を入力してください。");
  }

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      category: category || null,
      pref: pref || null,
      city: city || null,
      address,
      tel,
      hours,
      description,
      line_url: lineUrl || null,
      area_keywords: areaKeywords || null,
    })
    .eq("id", storeId)
    .eq("owner_user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

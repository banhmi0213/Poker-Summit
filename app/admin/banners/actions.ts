"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function createBanner(formData: FormData) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  const position = String(formData.get("position") ?? "top").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;

  if (!title) {
    throw new Error("バナー名を入力してください。");
  }

  const { data: banner, error } = await supabase
    .from("banners")
    .insert({
      title,
      image_url: imageUrl || null,
      link_url: linkUrl || null,
      position,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "banner_create", "banner", banner.id, { title });

  revalidatePath("/admin/banners");
}

export async function toggleBannerActive(bannerId: string, active: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("banners")
    .update({ active })
    .eq("id", bannerId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(
    supabase,
    active ? "banner_activate" : "banner_deactivate",
    "banner",
    bannerId
  );

  revalidatePath("/admin/banners");
}

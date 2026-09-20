"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("banners").insert({
    title,
    image_url: imageUrl || null,
    link_url: linkUrl || null,
    position,
    sort_order: sortOrder,
  });

  if (error) {
    throw new Error(error.message);
  }

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

  revalidatePath("/admin/banners");
}

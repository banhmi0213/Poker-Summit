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
  const address = String(formData.get("address") ?? "");
  const tel = String(formData.get("tel") ?? "");
  const hours = String(formData.get("hours") ?? "");
  const description = String(formData.get("description") ?? "");

  const { error } = await supabase
    .from("stores")
    .update({ address, tel, hours, description })
    .eq("id", storeId)
    .eq("owner_user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
}

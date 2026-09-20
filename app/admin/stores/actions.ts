"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setStoreStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/stores");
  revalidatePath("/");
}

export async function setStoreOwnerByEmail(formData: FormData) {
  const supabase = await createClient();

  const storeId = String(formData.get("storeId") ?? "");
  const email = String(formData.get("email") ?? "").trim();

  if (!storeId || !email) {
    throw new Error("店舗とメールアドレスを指定してください。");
  }

  const { error } = await supabase.rpc("admin_set_store_owner_by_email", {
    p_store_id: storeId,
    p_email: email,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/stores");
}

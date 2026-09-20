"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setStoreStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, `store_status_${status}`, "store", id);

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

  await logAdminAction(supabase, "store_set_owner", "store", storeId, { email });

  revalidatePath("/admin/stores");
}

export async function createStoreByAdmin(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const hours = String(formData.get("hours") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    throw new Error("店舗名を入力してください。");
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name,
      category: category || null,
      region: region || null,
      pref: pref || null,
      city: city || null,
      address: address || null,
      tel: tel || null,
      hours: hours || null,
      description: description || null,
      status: "approved",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_create", "store", data?.id, { name });

  revalidatePath("/admin/stores");
  revalidatePath("/");
}

export async function updateStoreByAdmin(formData: FormData) {
  const supabase = await createClient();
  const storeId = String(formData.get("storeId") ?? "");

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const tel = String(formData.get("tel") ?? "").trim();
  const hours = String(formData.get("hours") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    throw new Error("店舗名を入力してください。");
  }

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      category: category || null,
      region: region || null,
      pref: pref || null,
      city: city || null,
      address: address || null,
      tel: tel || null,
      hours: hours || null,
      description: description || null,
    })
    .eq("id", storeId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_edit", "store", storeId);

  revalidatePath("/admin/stores");
  revalidatePath("/");
  revalidatePath(`/stores/${storeId}`);
}

export async function deleteStoreByAdmin(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_delete", "store", id);

  revalidatePath("/admin/stores");
  revalidatePath("/");
}

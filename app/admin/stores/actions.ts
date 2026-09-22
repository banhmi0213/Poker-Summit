"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

function randomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomLoginId(storeId: string) {
  return `store-${storeId.slice(0, 8)}`;
}

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

export async function setStoreRecommended(id: string, recommended: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ is_recommended: recommended })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, recommended ? "store_recommend_on" : "store_recommend_off", "store", id);

  revalidatePath("/admin/stores");
  revalidatePath("/");
  revalidatePath("/stores/featured");
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
  const areaKeywords = String(formData.get("areaKeywords") ?? "").trim();

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
      area_keywords: areaKeywords || null,
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

export async function issueStoreLogin(storeId: string) {
  const supabase = await createClient();
  const loginId = randomLoginId(storeId);
  const password = randomPassword();

  const { error } = await supabase.rpc("admin_issue_store_login", {
    p_store_id: storeId,
    p_login_id: loginId,
    p_password: password,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "store_issue_login", "store", storeId, { loginId });

  const jar = await cookies();
  jar.set("issued_credentials", JSON.stringify({ storeId, loginId, password }), {
    httpOnly: true,
    maxAge: 60,
    path: "/admin/stores",
  });

  revalidatePath("/admin/stores");
  redirect("/admin/stores");
}

export async function reissueStorePassword(storeId: string) {
  const supabase = await createClient();
  const password = randomPassword();

  const { error } = await supabase.rpc("admin_reissue_store_password", {
    p_store_id: storeId,
    p_new_password: password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: loginId } = await supabase.rpc("admin_get_store_login_id", {
    p_store_id: storeId,
  });

  await logAdminAction(supabase, "store_reissue_password", "store", storeId);

  const jar = await cookies();
  jar.set("issued_credentials", JSON.stringify({ storeId, loginId, password }), {
    httpOnly: true,
    maxAge: 60,
    path: "/admin/stores",
  });

  revalidatePath("/admin/stores");
  redirect("/admin/stores");
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
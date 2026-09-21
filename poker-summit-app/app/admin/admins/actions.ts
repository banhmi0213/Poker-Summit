"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function addAdminByEmail(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "support").trim();

  if (!email) {
    throw new Error("メールアドレスを入力してください。");
  }

  const { error } = await supabase.rpc("admin_add_admin_by_email", {
    p_email: email,
    p_role: role,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "admin_add", "admin_user", undefined, { email, role });

  revalidatePath("/admin/admins");
}

export async function setAdminRole(userId: string, role: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_admin_role", {
    p_user_id: userId,
    p_role: role,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "admin_set_role", "admin_user", userId, { role });

  revalidatePath("/admin/admins");
}

export async function setAdminActive(userId: string, active: boolean) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_admin_active", {
    p_user_id: userId,
    p_active: active,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, active ? "admin_activate" : "admin_deactivate", "admin_user", userId);

  revalidatePath("/admin/admins");
}

export async function removeAdmin(userId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_remove_admin", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "admin_remove", "admin_user", userId);

  revalidatePath("/admin/admins");
}

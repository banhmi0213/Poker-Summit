"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";

export async function setMemberSuspended(userId: string, suspended: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_suspended", {
    p_user_id: userId,
    p_suspended: suspended,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(
    supabase,
    suspended ? "member_suspend" : "member_unsuspend",
    "member",
    userId
  );
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
}

export async function deleteMember(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_member", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "member_delete", "member", userId);
  revalidatePath("/admin/members");
}

export async function sendMemberPasswordReset(email: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://poker-summit.vercel.app/account/password",
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, "member_password_reset_sent", "member", userId);
  revalidatePath(`/admin/members/${userId}`);
}

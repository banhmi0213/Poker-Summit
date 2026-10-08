"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordPolicyError } from "@/lib/password-policy";

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const passwordError = passwordPolicyError(password);
  if (passwordError) {
    redirect(`/account/password?error=${encodeURIComponent(passwordError)}`);
  }

  if (password !== passwordConfirm) {
    redirect(
      `/account/password?error=${encodeURIComponent("確認用パスワードが一致しません。")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/account/password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/account/password?done=1");
}

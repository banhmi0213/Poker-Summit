"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordPolicyError } from "@/lib/password-policy";

export async function changePassword(formData: FormData) {
  const q = String(formData.get("from") ?? "") === "admin" ? "from=admin&" : "";
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const passwordError = passwordPolicyError(password);
  if (passwordError) {
    redirect(`/account/password?${q}error=${encodeURIComponent(passwordError)}`);
  }

  if (password !== passwordConfirm) {
    redirect(
      `/account/password?${q}error=${encodeURIComponent("確認用パスワードが一致しません。")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/account/password?${q}error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/account/password?${q}done=1`);
}

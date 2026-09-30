"use server";

import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";

// 店舗用Cookie(STORE_AUTH_COOKIE_NAME)のセッションに対してパスワードを
// 変更する。app/account/password/actions.ts (会員・総合管理画面用、
// デフォルトCookie)とは別物(2026/09/30、店舗/管理者セッション分離)。
export async function changeStorePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 6) {
    redirect(
      `/store/profile/password?error=${encodeURIComponent("パスワードは6文字以上で入力してください。")}`
    );
  }

  if (password !== passwordConfirm) {
    redirect(
      `/store/profile/password?error=${encodeURIComponent("確認用パスワードが一致しません。")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/store/profile/password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/store/profile/password?done=1");
}

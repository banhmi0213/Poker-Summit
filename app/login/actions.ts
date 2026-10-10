"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginLockMessage, recordLoginFailure, recordLoginLocked, recordLoginSuccess, requestMeta } from "@/lib/login-guard";

// 会員・運営(admin_users)向けの通常ログイン。実メールアドレスでのログイン
// のみを扱う。店舗管理のログインID("store-xxxxxxxx"形式・パスワード)は
// 会員ログインと混ざって分かりにくいとの指摘(2026/09/30)を受けて、
// 専用の店舗ログイン画面(/store/login, app/store/login/actions.ts)に
// 分離した。
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const meta = await requestMeta();
  const lockMessage = await loginLockMessage("member", email, meta.ip);
  if (lockMessage) {
    await recordLoginLocked("member", email, meta);
    redirect(`/login?error=${encodeURIComponent(lockMessage)}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordLoginFailure("member", email, meta);
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`
    );
  }
  await recordLoginSuccess("member", email, meta, data.user?.id ?? null);

  if (next) {
    redirect(next);
  }

  const userId = data.user?.id;

  if (userId) {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminRow) {
      redirect("/admin/stores");
    }

    const { data: ownedStore } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (ownedStore) {
      redirect("/store/profile");
    }
  }

  redirect("/mypage");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

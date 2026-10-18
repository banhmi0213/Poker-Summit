"use server";

import { authErrorMessage } from "@/lib/auth-error";

import { loginDestination } from "@/lib/login-destination";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginLockMessage, recordLoginFailure, recordLoginLocked, recordLoginSuccess, requestMeta } from "@/lib/login-guard";

// 会員・運営(admin_users)向けの通常ログイン。実メールアドレスでのログイン
// のみを扱う。店舗管理のログインID("store-xxxxxxxx"形式・パスワード)は
// 会員ログインと混ざって分かりにくいとの指摘(2026/09/30)を受けて、
// 専用の店舗ログイン画面(/store/login, app/store/login/actions.ts)に
// 分離した。
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").normalize("NFKC").trim();
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
    // メール確認がまだの人(パスワードは正しい)には、確認メールを自動で送り直す(2026/10/18)。
    // 確認メールが遅れて届かず期限切れになった人が、自分で登録を完了できるように。
    if (/email not confirmed/i.test(error.message)) {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: "https://pokersummit.jp/mypage" },
      });
      const msg = resendError
        ? `メールアドレスの確認が済んでいません。${authErrorMessage(resendError.message)}`
        : "メールアドレスの確認が済んでいないため、確認メールを送り直しました。メール内のリンクを押すと登録が完了します（有効期限24時間・迷惑メールフォルダもご確認ください）。";
      redirect(`/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`);
    }
    await recordLoginFailure("member", email, meta);
    redirect(
      `/login?error=${encodeURIComponent(authErrorMessage(error.message))}&next=${encodeURIComponent(next)}`
    );
  }
  await recordLoginSuccess("member", email, meta, data.user?.id ?? null);

  redirect(loginDestination(next, "member"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

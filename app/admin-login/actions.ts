"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginLockMessage, recordLoginFailure, recordLoginLocked, recordLoginSuccess, requestMeta } from "@/lib/login-guard";
import { sendLoginNotificationEmail } from "@/lib/email";

// 総合管理画面(/admin)専用のログイン。認証自体は会員ログイン(/login)と
// 同じSupabase Authのメールアドレス+パスワードをそのまま使う(admin_users
// に登録済みのアカウントでログインする想定)。店舗管理ログイン(別Cookie:
// STORE_AUTH_COOKIE_NAME)と違い、運営アカウントは会員と同じ認証の上に
// admin_usersで権限判定するだけなので、Cookie自体は分けなくてよい。画面を
// 分けたのは、/loginの「会員登録」「店舗管理ログイン」導線が運営ログイン
// には不要で紛らわしいとの指摘のため(2026/10、「adminは専用のログイン
// 画面作って」との指示)。URLを/admin/loginではなく/admin-loginにしている
// のは、/admin配下はapp/admin/layout.tsxのadmin_usersチェックが全ページに
// かかっており、/admin/loginをそこに置くと未ログイン→ログイン画面へ
// リダイレクト→そのログイン画面自体も同じチェックで再度リダイレクトされ
// ループしてしまうため(ログイン画面だけ保護対象から外す、という既存の
// レイアウト構成では難しい分岐を避けるための意図的な配置)。
export async function adminSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim() || "/admin/stores";

  const meta = await requestMeta();
  const lockMessage = await loginLockMessage("admin", email, meta.ip);
  if (lockMessage) {
    await recordLoginLocked("admin", email, meta);
    redirect(`/admin-login?error=${encodeURIComponent(lockMessage)}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordLoginFailure("admin", email, meta);
    redirect(
      `/admin-login?error=${encodeURIComponent("メールアドレスまたはパスワードが正しくありません。")}&next=${encodeURIComponent(next)}`
    );
  }

  await recordLoginSuccess("admin", email, meta, data.user?.id ?? null);
  try {
    if (data.user?.email) {
      await sendLoginNotificationEmail({ to: data.user.email, accountLabel: "Poker Summit 総合管理画面", at: new Date(), ip: meta.ip, userAgent: meta.userAgent });
    }
  } catch {
    // 通知に失敗してもログインは続ける
  }

  redirect(next);
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_LOGIN_ID_DOMAIN } from "@/lib/constants";

// 店舗管理専用のログイン処理。ログインID("store-xxxxxxxx"形式・@を含まない)
// を、発行時(lib/store-provision.ts の system_issue_store_login() /
// app/admin/stores/actions.ts の admin_issue_store_login())と同じ規則で
// Supabase Auth上の実メールアドレス("loginId@login.poker-summit.jp")に
// 変換してからサインインする。DB側はloginIdをlower(trim())してから
// メールアドレスを組み立てて登録しているため、ここでも同じ正規化をする。
export async function storeSignIn(formData: FormData) {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!loginId) {
    redirect(
      `/store/login?error=${encodeURIComponent("ログインIDを入力してください。")}&next=${encodeURIComponent(next)}`
    );
  }

  const email = `${loginId.toLowerCase()}@${STORE_LOGIN_ID_DOMAIN}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/store/login?error=${encodeURIComponent("ログインIDまたはパスワードが正しくありません。")}&next=${encodeURIComponent(next)}`
    );
  }

  redirect(next || "/store/profile");
}

export async function storeSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/store/login");
}

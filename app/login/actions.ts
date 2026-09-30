"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_LOGIN_ID_DOMAIN } from "@/lib/constants";

export async function signIn(formData: FormData) {
  const rawInput = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  // 店舗管理画面のログインIDは "store-xxxxxxxx" 形式(@を含まない)。
  // 発行時(lib/store-provision.ts / app/admin/stores/actions.ts)は
  // Supabase Auth上のメールアドレスとして "loginId@login.poker-summit.jp"
  // で登録しているため、入力に@が含まれない(=店舗ログインID)場合はここで
  // 同じ形式に変換してからサインインする。通常会員・管理者は実メール
  // アドレス(@を含む)でログインするのでそのまま使う。(2026/09/30、
  // ログイン画面には「メールアドレス」欄しかなく店舗ログインIDをそのまま
  // 入力してもサインインできなかった不具合の修正)
  // DB側(admin_issue_store_login/system_issue_store_login)はloginIdを
  // lower(trim())してからメールアドレスを組み立てて登録しているため、
  // ここでも同じ正規化をして一致させる。
  const email = rawInput.includes("@")
    ? rawInput
    : `${rawInput.toLowerCase()}@${STORE_LOGIN_ID_DOMAIN}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`
    );
  }

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

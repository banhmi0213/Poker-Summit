"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  // 都道府県の公開設定(2026/10追加)。未指定時は従来通り公開扱い。
  const prefPublic = String(formData.get("prefPublic") ?? "public").trim() !== "private";

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("メールアドレスとパスワードを入力してください。")}`);
  }

  if (password.length < 6) {
    redirect(`/signup?error=${encodeURIComponent("パスワードは6文字以上で入力してください。")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name || undefined, pref: pref || undefined, pref_public: prefPublic },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect("/mypage");
  }

  redirect("/signup?done=1");
}

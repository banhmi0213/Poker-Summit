"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

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
      data: { display_name: name || undefined },
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

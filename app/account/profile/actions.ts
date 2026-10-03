"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ハンドルネーム・都道府県の変更(2026/10、「ハンドルネームの修正欄がない」
// との指摘を受けて追加)。signup/actions.tsのsignUp()と同じく、
// user_metadata(display_name/pref)に保存する。account/password/actions.ts
// と同じパターン(エラー/成功はredirect先のURLパラメータで伝える)。
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/profile");
  }

  const name = String(formData.get("name") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();

  if (!pref) {
    redirect(`/account/profile?error=${encodeURIComponent("都道府県を選んでください。")}`);
  }

  const { error } = await supabase.auth.updateUser({
    data: { display_name: name, pref },
  });

  if (error) {
    redirect(`/account/profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/account/profile?done=1");
}

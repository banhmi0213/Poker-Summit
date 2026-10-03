"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ハンドルネーム・都道府県の変更(2026/10、「ハンドルネームの修正欄がない」
// との指摘を受けて追加)。signup/actions.tsのsignUp()と同じく、
// user_metadata(display_name/pref)に保存する。account/password/actions.ts
// と同じパターン(エラー/成功はredirect先のURLパラメータで伝える)。
// 役職・フリーメッセージ(2026/10追加)は他の会員からも見える情報のため、
// user_metadataではなくprofilesテーブル(avatar_urlと同じ、他人からも
// 読めるテーブル)にupsertする。mypage/actions.tsのuploadAvatar()と同じ
// upsertパターン。
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
  const role = String(formData.get("role") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 300);

  if (!pref) {
    redirect(`/account/profile?error=${encodeURIComponent("都道府県を選んでください。")}`);
  }

  const { error } = await supabase.auth.updateUser({
    data: { display_name: name, pref },
  });

  if (error) {
    redirect(`/account/profile?error=${encodeURIComponent(error.message)}`);
  }

  // display_nameもprofilesへミラーしておく(2026/10追加)。会員プロフィール
  // ページ(/members/[id])は他人のauth.users.user_metadataを直接読めない
  // ため、ここで公開テーブル側にも複製しておく必要がある。
  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    display_name: name || null,
    role: role || null,
    bio: bio || null,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    redirect(`/account/profile?error=${encodeURIComponent(profileError.message)}`);
  }

  // サミット一覧・詳細、会員プロフィールページの役職表示にも反映させる。
  revalidatePath("/mypage");
  revalidatePath("/board");

  redirect("/account/profile?done=1");
}

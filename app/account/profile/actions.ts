"use server";

import { authErrorMessage } from "@/lib/auth-error";

import { normalizeMHoldemId, mHoldemIdError } from "@/lib/m-holdem";
import { redirect } from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { handleNameError } from "@/lib/handle-name";

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
  // m HOLD'EM ID は一度登録したら本人は変更できない(2026/10/19、複垢対策)。
  // 未登録のときだけ、ここで1回登録できる(member_m_holdem_ids。変更は総合管理のみ)
  const mHoldemId = normalizeMHoldemId(formData.get("mHoldemId"));
  const idError = mHoldemIdError(mHoldemId);
  if (idError) redirect(`/account/profile?error=${encodeURIComponent(idError)}`);
  const pref = String(formData.get("pref") ?? "").trim();
  // 都道府県の公開設定(2026/10追加、「会員登録時都道府県を非公開にできる
  // ように」との指示。登録後もここで切り替えられるようにする)。
  const prefPublic = String(formData.get("prefPublic") ?? "public").trim() !== "private";
  const emailPublic = formData.get("emailPublic") === "public";
  const role = String(formData.get("role") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 300);

  // 都道府県は任意(2026/10/20、登録画面から外したため)
  // 今の名前のままなら確認しない(文字数を短くした 2026/10/30 より前の長い名前も、そのまま使える)
  if (name && name !== String(user.user_metadata?.display_name ?? "").trim()) {
    // 「運営」バッジの運営アカウントだけは「運営」等を含む名前にできる
    const { data: official } = await supabase.rpc("official_board_user_ids", { p_ids: [user.id] });
    const isOfficial = ((official ?? []) as unknown[]).length > 0;
    const nameError = handleNameError(name);
    if (nameError && !(isOfficial && name.length <= 20)) redirect(`/account/profile?error=${encodeURIComponent(nameError)}`);
  }

  const { error } = await supabase.auth.updateUser({
    data: { display_name: name, pref, pref_public: prefPublic },
  });

  if (error) {
    redirect(`/account/profile?error=${encodeURIComponent(authErrorMessage(error.message))}`);
  }

  if (mHoldemId) {
    const { data: current } = await supabase.from("member_m_holdem_ids").select("m_holdem_id").eq("user_id", user.id).maybeSingle();
    if (!current) {
      const { error: idSetError } = await supabase.rpc("set_my_m_holdem_id", { p_id: mHoldemId });
      if (idSetError) redirect(`/account/profile?error=${encodeURIComponent(idSetError.message)}`);
    }
  }

  // display_nameもprofilesへミラーしておく(2026/10追加)。会員プロフィール
  // ページ(/members/[id])は他人のauth.users.user_metadataを直接読めない
  // ため、ここで公開テーブル側にも複製しておく必要がある。
  // 都道府県・公開設定もprofilesへミラーする(2026/10追加)。公開設定を
  // 他人から見える会員プロフィールページ(/members/[id])で判定するため、
  // 公開/非公開のどちらでも値自体はprofilesに保存し、表示側でpref_public
  // を見て出し分ける(非公開時にここで値を落とすと本人の編集画面にも
  // 復元できなくなるため)。
  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    display_name: name || null,
    role: role || null,
    bio: bio || null,
    pref: pref || null,
    pref_public: prefPublic,
    email_public: emailPublic,
    public_email: emailPublic ? (user.email ?? null) : null,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    redirect(`/account/profile?error=${encodeURIComponent(profileError.message)}`);
  }

  // サミット一覧・詳細、会員プロフィールページの役職表示にも反映させる。
  revalidatePath("/mypage");
  revalidatePath("/board");
  revalidatePath(`/members/${user.id}`);
  revalidatePath("/account/profile");

  redirect("/account/profile?done=1");
}

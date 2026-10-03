import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";
import { PREF_OPTIONS, MEMBER_ROLE_OPTIONS } from "@/lib/constants";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/profile");
  }

  const params = searchParams;
  const currentName = (user.user_metadata as any)?.display_name || "";
  const currentPref = (user.user_metadata as any)?.pref || "";

  // 役職・フリーメッセージ(2026/10、「都道府県の下にプルタブで役職を
  // 設置、フリーメッセージをつけて」との指示)。他の会員からも見える
  // 情報なので、auth.updateUser()のuser_metadataではなく、他人からも
  // 読めるprofilesテーブル(avatar_urlと同じ場所)に保存する。
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role, bio")
    .eq("user_id", user.id)
    .maybeSingle();
  const currentRole = myProfile?.role || "";
  const currentBio = myProfile?.bio || "";

  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 40 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>プロフィール編集</h1>
      <div className="card">
        {params.error && <p className="err">{params.error}</p>}
        {params.done && (
          <p className="muted" style={{ marginBottom: 12, color: "var(--good)" }}>
            プロフィールを変更しました。
          </p>
        )}
        <form action={updateProfile}>
          <div className="field">
            <span>ハンドルネーム</span>
            <input type="text" name="name" defaultValue={currentName} autoComplete="nickname" />
          </div>
          <div className="field">
            <span>都道府県</span>
            <select name="pref" defaultValue={currentPref} required>
              <option value="" disabled>
                選択してください
              </option>
              {PREF_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>役職</span>
            <select name="role" defaultValue={currentRole}>
              <option value="">未設定</option>
              {MEMBER_ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>フリーメッセージ</span>
            <textarea
              name="bio"
              rows={3}
              defaultValue={currentBio}
              placeholder="自己紹介やひとことをどうぞ"
              maxLength={300}
            />
          </div>
          <button type="submit" className="btn primary" style={{ width: "100%" }}>
            変更する
          </button>
        </form>
      </div>
    </div>
  );
}

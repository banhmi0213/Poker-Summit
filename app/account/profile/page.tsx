import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";
import { PREF_OPTIONS } from "@/lib/constants";

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
          <button type="submit" className="btn primary" style={{ width: "100%" }}>
            変更する
          </button>
        </form>
      </div>
    </div>
  );
}

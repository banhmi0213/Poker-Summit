import { updateProfile } from "@/app/account/profile/actions";
import { PREF_OPTIONS, MEMBER_ROLE_OPTIONS } from "@/lib/constants";
import styles from "./profile-layout.module.css";

export function ProfileEditor({ name, pref, prefPublic, role, bio, error, done }: {
  name: string; pref: string; prefPublic: boolean; role: string; bio: string; error?: string; done?: string;
}) {
  return <aside className={styles.editor} aria-labelledby="profile-editor-title">
    <h2 id="profile-editor-title">⚙ プロフィール情報の編集</h2>
    <p className={styles.description}>公開される情報やプロフィールの設定を変更できます。</p>
    {error && <p className="err" role="alert">{error}</p>}
    {done && <p className={styles.success} role="status">プロフィールを変更しました。</p>}
    <form action={updateProfile}>
      <label className={styles.field}><span>ハンドルネーム</span><input name="name" type="text" defaultValue={name} autoComplete="nickname" /></label>
      <label className={styles.field}><span>都道府県</span><select name="pref" defaultValue={pref} required><option value="" disabled>選択してください</option>{PREF_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      <label className={styles.field}><span>都道府県の公開設定</span><select name="prefPublic" defaultValue={prefPublic ? "public" : "private"}><option value="public">公開（他の会員にも表示）</option><option value="private">非公開（自分だけに表示）</option></select></label>
      <label className={styles.field}><span>役職</span><select name="role" defaultValue={role}><option value="">未設定</option>{MEMBER_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      <label className={styles.field}><span>フリーメッセージ</span><textarea name="bio" rows={4} maxLength={300} defaultValue={bio} placeholder="自己紹介やひとことをどうぞ" /></label>
      <button type="submit" className={`btn primary ${styles.save}`}>変更する</button>
    </form>
  </aside>;
}

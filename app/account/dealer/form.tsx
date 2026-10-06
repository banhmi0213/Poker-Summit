"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveDealer } from "./actions";
import { DEALER_GAMES, type DealerProfile } from "@/lib/dealers";
import { PREF_OPTIONS } from "@/lib/constants";
import styles from "./dealer.module.css";
function Submit(){const { pending }=useFormStatus();return <button className="btn primary" type="submit" disabled={pending}>{pending ? "保存中…" : "保存する"}</button>;}
export function DealerForm({ profile, address, photo }: { profile: DealerProfile | null; address: string; photo: string | null }) {
 const [state, action]=useFormState(saveDealer,{ error: "" });
 return <form action={action} className={styles.card}>
 {state.error && <p className="err" role="alert">{state.error}</p>}
 <div className={styles.fields}>
 <div className={styles.wide}><label className={styles.field}>プロフィール写真
 {photo && <img className={styles.photo} src={photo} alt="現在のプロフィール写真" />}
 <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
 <span className={styles.hint}>JPEG・PNG・WebP、3MB以内。写真は本人と店舗アカウントだけが閲覧できます。</span>
 </label>{profile?.photo_url && <label><input type="checkbox" name="removePhoto" /> 現在の写真を削除する</label>}</div>
 <label className={styles.field}>氏名 *<input name="name" defaultValue={profile?.full_name ?? ""} maxLength={100} autoComplete="name" required /></label>
 <label className={styles.field}>年齢 *<input name="age" type="number" min={0} max={120} step={1} defaultValue={profile?.age ?? ""} required /></label>
 <label className={styles.field}>ディーラー種別<select name="dealerType" defaultValue={profile?.dealer_type ?? "ディーラー"}><option>ディーラー</option><option>フリーディーラー</option></select></label>
 <label className={styles.field}>住所（都道府県） *<select name="pref" defaultValue={profile?.pref ?? ""} required><option value="">選択してください</option>{PREF_OPTIONS.map(p=><option key={p}>{p}</option>)}</select></label>
 <label className={styles.field+" "+styles.wide}>住所（市区町村・番地など） *<input name="address" defaultValue={address} maxLength={300} autoComplete="street-address" required /></label>
 <fieldset className={styles.games+" "+styles.wide}><legend>対応可能なゲーム種目 *（複数選択）</legend>{DEALER_GAMES.map(g=><label key={g}><input type="checkbox" name="games" value={g} defaultChecked={profile?.games.includes(g) ?? false} />{g}</label>)}</fieldset>
 <label className={styles.field}>経験年数 *<input name="years" type="number" min={0} max={80} step={0.1} defaultValue={profile?.experience_years ?? ""} required /><span className={styles.hint}>半年の場合は0.5年と入力できます。</span></label>
 <label className={styles.field+" "+styles.wide}>アピールポイント<textarea name="appeal" rows={7} maxLength={3000} defaultValue={profile?.appeal ?? ""} placeholder="得意なゲーム、ディーラー経験などを記載してください。" /></label>
 <label className={styles.wide}><input type="checkbox" name="published" defaultChecked={profile?.published ?? true} /> 店舗アカウントにプロフィールを表示する<p className={styles.hint}>一般会員には表示されません。チェックを外すと本人だけが閲覧できます。</p></label>
 </div><div className={styles.actions}><Submit /></div></form>;
}

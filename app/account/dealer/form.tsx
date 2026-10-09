"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DealerRegionField } from "./region-field";
import { inferDealerPrefectures } from "@/lib/dealer-regions";
import { WorkDates } from "./work-dates";
import { DealerPhotoField } from "./photo-field";
import { saveDealer } from "./actions";
import { DEALER_GAMES, DEALER_CONTRACT_STATUSES, DEALER_STATUS_LABEL, type DealerProfile } from "@/lib/dealers";
import { PREF_OPTIONS } from "@/lib/constants";
import styles from "./dealer.module.css";
function Submit(){const { pending }=useFormStatus();return <button className="btn primary" type="submit" disabled={pending}>{pending ? "保存中…" : "保存する"}</button>;}
export function DealerForm({ profile, address, photo, today, contacts }: { contacts: {phone:string;contact_type:string;contact_value:string;disclosure_consented_at:string|null}|null; profile: DealerProfile | null; address: string; photo: string | null; today: string }) {
 const [contactType,setContactType]=useState<"line"|"email">(contacts?.contact_type==="email"?"email":"line");
 const [dealerType,setDealerType]=useState(profile?.dealer_type ?? "ディーラー");
 const freelance=dealerType === "フリーディーラー";
 const [state, action]=useFormState(saveDealer,{ error: "" });
 return <form action={action} className={styles.card}>
 {state.error && <p className="err" role="alert">{state.error}</p>}
 <div className={styles.fields}>
 <DealerPhotoField kind={profile?.avatar_kind ?? null} photo={photo} hasPhoto={Boolean(profile?.photo_url)} />
 <label className={styles.field}>氏名 *<input name="name" defaultValue={profile?.full_name ?? ""} maxLength={100} autoComplete="name" required /></label>
 <label className={styles.field}>年齢 *<input name="age" type="number" min={0} max={120} step={1} defaultValue={profile?.age ?? ""} required /></label>
 <label className={styles.field}>ディーラー種別<select name="dealerType" value={dealerType} onChange={e=>setDealerType(e.target.value)}><option>ディーラー</option><option>フリーディーラー</option></select></label>
 <label className={styles.field}>受付状況 *<select name="contractStatus" defaultValue={profile?.contract_status ?? "契約可能"} required>{DEALER_CONTRACT_STATUSES.map(s=><option key={s} value={s}>{DEALER_STATUS_LABEL[s]}</option>)}</select><span className={styles.hint}>現在の募集状況を選択してください。店舗の一覧にも表示されます。</span></label>
 <DealerRegionField initial={profile?.available_prefectures?.length ? profile.available_prefectures : inferDealerPrefectures(profile?.available_regions ?? "")} required={freelance} />
 <label className={styles.field+" "+styles.wide}>対応地域の補足（任意）<input name="regionNote" maxLength={100} defaultValue={profile?.region_note ?? ""} placeholder="例：兵庫県は神戸市まで／遠方は交通費相談" /><span className={styles.hint}>市区町村や交通費などの条件を記載できます。</span></label>
 <label className={styles.field+" "+styles.wide}>対応可能時間{freelance ? " *" : "（任意）"}<textarea name="availableHours" rows={3} maxLength={500} defaultValue={profile?.available_hours ?? ""} required={freelance} placeholder="例：平日18:00〜24:00／土日祝12:00〜翌2:00（日本時間）" /><span className={styles.hint}>曜日・時間帯や深夜対応の可否を、日本時間で記載してください。フリーディーラーは対応地域・時間の両方が必須です。</span></label>
 <label className={styles.field}>住所（都道府県） *<select name="pref" defaultValue={profile?.pref ?? ""} required><option value="">選択してください</option>{PREF_OPTIONS.map(p=><option key={p}>{p}</option>)}</select></label>
 <label className={styles.field+" "+styles.wide}>住所（市区町村・番地など） *<input name="address" defaultValue={address} maxLength={300} autoComplete="street-address" required /></label>
 <section className={styles.wide} style={{ padding: 18, border: "1px solid #e2dacd", borderRadius: 10, background: "#faf7ef" }} aria-labelledby="dealer-private-contact-title">
 <h2 id="dealer-private-contact-title" style={{ fontSize: 16, margin: "0 0 8px" }}>非公開情報</h2>
 <p className={styles.hint} style={{ marginBottom: 16 }}>通常のプロフィールには表示されません。契約成立と開示への同意が確認された場合に、相手店舗にのみ公開します。</p>
 <div className={styles.fields}>
 <label className={styles.field}>電話番号<input name="phone" type="tel" autoComplete="tel" maxLength={30} defaultValue={contacts?.phone ?? ""} placeholder="例：090-1234-5678" /></label>
 <label className={styles.field}>連絡方法<select name="contactType" value={contactType} onChange={e=>setContactType(e.target.value as "line"|"email")}><option value="line">LINE</option><option value="email">メールアドレス</option></select></label>
 <label className={styles.field+" "+styles.wide}>{contactType==="line" ? "LINE IDまたは友だち追加URL" : "メールアドレス"}<input key={contactType} name="contactValue" type={contactType==="email" ? "email" : "text"} maxLength={254} autoComplete={contactType==="email" ? "email" : "off"} defaultValue={contacts?.contact_type===contactType ? contacts.contact_value : ""} placeholder={contactType==="email" ? "例：dealer@example.com" : "LINE IDまたは友だち追加URL"} /></label>
 </div>
 <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 16, fontSize: 13, lineHeight: 1.8 }}><input type="checkbox" name="contactDisclosureConsent" defaultChecked={Boolean(contacts?.disclosure_consented_at)} style={{ marginTop: 5 }} /><span>双方が勤務条件を確定した相手店舗への、電話番号とLINEまたはメールアドレスの開示に同意します。</span></label>
 <p className={styles.hint}>同意しない場合は保存後も非公開です。一般会員や契約相手ではない店舗には公開しません。</p>
 </section>
 <fieldset className={styles.games+" "+styles.wide}><legend>対応可能なゲーム種目 *（複数選択）</legend>{DEALER_GAMES.map(g=><label key={g}><input type="checkbox" name="games" value={g} defaultChecked={profile?.games.includes(g) ?? false} />{g}</label>)}</fieldset>
 <label className={styles.field}>経験年数 *<input name="years" type="number" min={0} max={80} step={0.1} defaultValue={profile?.experience_years ?? ""} required /><span className={styles.hint}>半年の場合は0.5年と入力できます。</span></label>
 <WorkDates initialDates={profile?.available_dates ?? []} today={today} />
 <label className={styles.field+" "+styles.wide}>アピールポイント<textarea name="appeal" rows={7} maxLength={3000} defaultValue={profile?.appeal ?? ""} placeholder="得意なゲーム、ディーラー経験などを記載してください。" /></label>
 <label className={styles.wide}><input type="checkbox" name="published" defaultChecked={profile?.published ?? true} /> 店舗アカウントにプロフィールを表示する<p className={styles.hint}>一般会員には表示されません。チェックを外すと本人だけが閲覧できます。</p></label>
 </div><div className={styles.actions}><Submit /></div></form>;
}


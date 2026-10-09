"use client";
import {useEffect,useState} from "react";
import {useFormState,useFormStatus} from "react-dom";
import {useRouter} from "next/navigation";
import {saveChatContacts} from "./actions";
import styles from "./chat.module.css";
function Save(){const {pending}=useFormStatus();return <button type="submit" className={styles.primary} disabled={pending}>{pending?"保存中…":"連絡先を登録・開示に同意する"}</button>;}
export function ChatContactForm({record,contact}:{record:string;contact:{phone:string;contact_type:string;contact_value:string}|null}){
 const [state,action]=useFormState(saveChatContacts,{error:"",success:0});const router=useRouter();
 const [kind,setKind]=useState(contact?.contact_type||"email");
 useEffect(()=>{if(state.success)router.refresh();},[state.success,router]);
 return <form action={action} className={styles.form}><input type="hidden" name="record" value={record}/><p>勤務条件への合意と、連絡先の開示同意は別です。電話番号とLINEまたはメールアドレスを登録してください。</p><label>電話番号<input name="phone" type="tel" required maxLength={30} defaultValue={contact?.phone||""}/></label><label>連絡方法<select name="contact_type" value={kind} onChange={e=>setKind(e.target.value)}><option value="email">メールアドレス</option><option value="line">LINE</option></select></label><label>{kind==="email"?"メールアドレス":"LINE IDまたは友だち追加URL"}<input key={kind} name="contact_value" type={kind==="email"?"email":"text"} required maxLength={254} defaultValue={contact?.contact_type===kind?contact.contact_value:""}/></label><label className={styles.check}><input name="agreed" type="checkbox" required/>双方が勤務条件を確定した相手店舗への、電話番号とLINEまたはメールアドレスの開示に同意します。</label>{state.error&&<p role="alert" className={styles.error}>{state.error}</p>}{state.success>0&&<p role="status">連絡先と開示同意を保存しました。</p>}<Save/></form>;
}

"use client";
// 確定後の勤務キャンセルと、キャンセルされた側の言い分の入力(2026/10/22)
import {useFormState,useFormStatus} from "react-dom";
import {cancelWork,replyCancel} from "./actions";
import ratingStyles from "./stars.module.css";
import styles from "@/app/spot-jobs/spot.module.css";

import {CANCEL_REASONS} from "@/lib/cancel-reasons";

function Submit({label}:{label:string}){const {pending}=useFormStatus();return <button className={styles.button} disabled={pending}>{pending?"保存中…":label}</button>;}

export function CancelForm({actor,id,workStart}:{actor:"store"|"dealer";id:string;workStart:string}){
 const [state,action]=useFormState(cancelWork,{error:""});
 const late=Date.parse(workStart)-Date.now()<3*3600*1000;
 const area:React.CSSProperties={display:"block",width:"100%",marginTop:8,padding:12,border:"1px solid #d9bd8e",borderRadius:8,background:"#faf7ef",boxSizing:"border-box"};
 return <details style={{marginTop:16}}><summary style={{cursor:"pointer"}}>この勤務をキャンセルする</summary>
  <form action={action} style={{marginTop:12}}>
   <input type="hidden" name="actor" value={actor}/><input type="hidden" name="id" value={id}/>
   {actor==="store"
    ?<p className={styles.error} style={{marginTop:0}}>確定後の店舗都合のキャンセルは原則できません。雇用契約の場合は、休業手当（平均賃金の6割以上）の支払いが必要になることがあります。キャンセルの記録と理由は、ディーラーが見られる店舗の情報に残ります。</p>
    :<p className={styles.error} style={{marginTop:0}}>キャンセルの記録と理由は、店舗が見られるあなたの勤務実績に残ります。</p>}
   {late&&<p className={styles.error}>勤務開始の3時間前を過ぎているため「直前キャンセル」として記録されます。</p>}
   <label style={{display:"block",marginBottom:12}}>キャンセルの理由<select name="code" required defaultValue="" style={{display:"block",marginTop:8}}><option value="">選択してください</option>{CANCEL_REASONS.map(([c,l])=><option key={c} value={c}>{l}</option>)}</select></label>
   <label style={{display:"block",marginBottom:12}}>くわしい理由（相手にも表示されます）<textarea name="reason" required maxLength={1000} rows={4} style={area} placeholder="連絡先やURLは書かないでください。"/></label>
   <label style={{display:"block",marginBottom:12}}><input type="checkbox" name="agreed" required/> キャンセルは取り消せないこと、使った回数は戻らないことを確認しました。</label>
   <Submit label="キャンセルする"/>{state.error&&<p className={styles.error} role="alert">{state.error}</p>}
  </form></details>;
}

export function CancelReplyForm({actor,id}:{actor:"store"|"dealer";id:string}){
 const [state,action]=useFormState(replyCancel,{error:""});
 return <form action={action} style={{marginTop:12}}>
  <input type="hidden" name="actor" value={actor}/><input type="hidden" name="id" value={id}/>
  <fieldset className={ratingStyles.field}><legend>{actor==="store"?"ディーラーの評価":"店舗の評価"}（キャンセルについて）</legend><div className={ratingStyles.choices}>{[1,2,3,4,5].map(n=><label className={ratingStyles.choice} key={n}><input type="radio" name="rating" value={n} required aria-label={`5つ星中${n}`}/><span aria-hidden="true">{n} ★</span></label>)}</div><p className={ratingStyles.hint}>この評価は通常の星の平均には入りません。キャンセルの記録と一緒に表示されます。</p></fieldset>
  <label style={{display:"block",marginBottom:12}}>あなたの言い分（1回だけ・30日以内）<textarea name="comment" required maxLength={1000} rows={4} style={{display:"block",width:"100%",marginTop:8,padding:12,border:"1px solid #d9bd8e",borderRadius:8,background:"#faf7ef",boxSizing:"border-box"}} placeholder="連絡の有無や経緯など。連絡先やURLは書かないでください。"/></label>
  <Submit label="言い分を保存する"/>{state.error&&<p className={styles.error} role="alert">{state.error}</p>}
 </form>;
}

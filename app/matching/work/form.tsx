"use client";
import {useFormState,useFormStatus} from "react-dom";
import {submitWork} from "./actions";
import styles from "@/app/spot-jobs/spot.module.css";
function Submit({label}:{label:string}){const {pending}=useFormStatus();return <button className={styles.button+" "+styles.primary} disabled={pending}>{pending?"保存中…":label}</button>;}
export function WorkForm({actor,operation,id,job,date,review}:{actor:"store"|"dealer";operation:"request"|"confirm"|"review"|"complete";id?:string;job?:string;date?:string;review?:string|null}){
 const [state,action]=useFormState(submitWork,{error:""});
 const label={request:"この勤務日に応募する",confirm:"勤務条件を確定する",review:"レビューを保存",complete:"勤務完了"}[operation];
 return <form action={action}><input type="hidden" name="actor" value={actor}/><input type="hidden" name="operation" value={operation}/>{id&&<input type="hidden" name="id" value={id}/>} {job&&<input type="hidden" name="job" value={job}/>} {date&&<input type="hidden" name="date" value={date}/>}
 {operation==="review"&&<label style={{display:"block",marginBottom:12}}>{actor==="store"?"勤務したディーラーへのレビュー":"勤務した店舗へのレビュー"}<textarea name="review" required maxLength={2000} defaultValue={review||""} rows={4} style={{display:"block",width:"100%",marginTop:8,padding:12,border:"1px solid #d9bd8e",borderRadius:8,background:"#faf7ef",boxSizing:"border-box"}} placeholder="勤務して感じたことを記載してください。連絡先や他人の個人情報は記載しないでください。"/></label>}
 {operation==="confirm"&&<label style={{display:"block",marginBottom:12}}><input type="checkbox" name="agreed" required/> 勤務日・時間・報酬・交通費を確認し、契約形態や支払方法などの条件を相手と合意しました。</label>}
 {operation==="request"&&<p className={styles.muted}>応募だけでは勤務は確定しません。応募後に双方が勤務条件を確定します。</p>}
 <Submit label={label}/>{state.error&&<p className={styles.error} role="alert">{state.error}</p>}</form>;
}

"use client";
// 求人を作らずにディーラーへ直接オファーするフォーム(2026/10/22)。前回の内容を最初から入れておき、変わるところだけ直してもらう。
import {useState} from "react";
import {useFormState,useFormStatus} from "react-dom";
import {DEALER_GAMES} from "@/lib/dealers";
import {offerDirectAction} from "./actions";
import styles from "./chat.module.css";

export type OfferTemplate={games:string[];duties:string;requirements:string;transport_type:string;transport_limit:number|null;dress:string;contract_type:string|null;payment_method:string|null;payment_date:string|null;contract_notes:string|null;start_time:string;end_time:string;hourly_wage:number|null};

function Submit(){const {pending}=useFormStatus();return <button className={styles.primary} disabled={pending} type="submit">{pending?"送信中…":"この条件でオファーを送る"}</button>;}

export function DirectOfferForm({dealer,dates,template}:{dealer:string;dates:{min:string;max:string};template:OfferTemplate|null}){
 const [state,action]=useFormState(offerDirectAction,{error:"",success:0});
 const [transport,setTransport]=useState(template?.transport_type||"none");
 const t=template;
 const row:React.CSSProperties={display:"flex",gap:10,flexWrap:"wrap"};
 return <form action={action} className={styles.form}>
  <input type="hidden" name="dealer" value={dealer}/>
  {t&&<p style={{fontSize:13,margin:0}}>前回の内容が入っています。変わるところだけ直してください。</p>}
  <label>勤務日<input type="date" name="work_date" required min={dates.min} max={dates.max} defaultValue={dates.min}/></label>
  <div style={row}>
   <label>開始時間<input type="time" name="start_time" required defaultValue={t?.start_time||""}/></label>
   <label>終了時間<input type="time" name="end_time" required defaultValue={t?.end_time||""}/></label>
   <label>時給（円）<input type="number" name="hourly_wage" min={1} max={100000} required defaultValue={t?.hourly_wage??""}/></label>
  </div>
  <fieldset style={{border:"none",padding:0,margin:0}}><legend>ゲーム種目</legend><div style={row}>{DEALER_GAMES.map(g=><label key={g} style={{fontWeight:400}}><input type="checkbox" name="games" value={g} defaultChecked={t?.games.includes(g)}/>{g}</label>)}</div></fieldset>
  <label>業務内容<textarea name="duties" required maxLength={3000} defaultValue={t?.duties||""}/></label>
  <label>応募条件（経験・スキル。任意）<textarea name="requirements" maxLength={3000} defaultValue={t?.requirements||""}/></label>
  <div style={row}>
   <label>交通費<select name="transport_type" value={transport} onChange={e=>setTransport(e.target.value)}><option value="none">支給なし</option><option value="full">全額支給</option><option value="limited">上限あり</option></select></label>
   {transport==="limited"&&<label>交通費の上限（円）<input type="number" name="transport_limit" min={0} max={100000} required defaultValue={t?.transport_limit??""}/></label>}
  </div>
  <label>服装・持ち物（任意）<textarea name="dress" maxLength={2000} defaultValue={t?.dress||""}/></label>
  <div style={row}>
   <label>契約形態<select name="contract_type" required defaultValue={t?.contract_type||""}><option value="">選択してください</option><option value="employment">雇用（アルバイト等）</option><option value="contract">業務委託</option></select></label>
   <label>支払方法<select name="payment_method" required defaultValue={t?.payment_method||""}><option value="">選択してください</option><option value="bank">銀行振込</option><option value="cash">現金</option></select></label>
   <label>支払日<input name="payment_date" required maxLength={100} defaultValue={t?.payment_date||""} placeholder="例：即日／翌月15日"/></label>
  </div>
  <label>その他の合意事項<textarea name="contract_notes" required maxLength={2000} defaultValue={t?.contract_notes||""} placeholder="深夜手当・税の取扱い・キャンセル時の対応など。ない場合は「なし」"/></label>
  {state.error&&<p role="alert" className={styles.error}>{state.error}</p>}
  <Submit/>
 </form>;
}

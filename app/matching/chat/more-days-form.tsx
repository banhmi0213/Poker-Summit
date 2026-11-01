"use client";
// チャットから同じディーラーに別の日も頼む(2026/10/22)。条件はこのチャットのまま、勤務日1日ごとに1回使う。
import {useState} from "react";
import Link from "next/link";
import {useFormState,useFormStatus} from "react-dom";
import {offerMoreDaysAction} from "./actions";
import styles from "./chat.module.css";

function Submit({count}:{count:number}){const {pending}=useFormStatus();return <button className={styles.primary} disabled={pending} type="submit">{pending?"送信中…":`${count}日分のオファーを送る（${count}回使います）`}</button>;}

export function MoreDaysForm({record,start,end,today}:{record:string;start:string;end:string;today:string}){
 const [state,action]=useFormState(offerMoreDaysAction,{error:"",sent:0});
 const [dates,setDates]=useState<string[]>([""]);
 const filled=dates.filter(Boolean).length;
 return <details className={styles.card}><summary style={{cursor:"pointer",fontWeight:700}}>この人に別の日も頼む</summary>
  <form action={action} className={styles.form} style={{marginTop:10}}>
   <input type="hidden" name="record" value={record}/>
   <p className={styles.muted} style={{margin:0}}>このチャットの条件（業務内容・時給・交通費・支払い条件など）のまま、選んだ日ごとにオファーを送ります。勤務日1日につき1回使います（プランの回数、なければディーラースカウト）。</p>
   {dates.map((d,i)=><label key={i}>勤務日{dates.length>1?` ${i+1}`:""}<input type="date" name="dates" min={today} value={d} onChange={e=>setDates(dates.map((x,k)=>k===i?e.target.value:x))} required={i===0}/></label>)}
   {dates.length<14&&<button type="button" className={styles.button} onClick={()=>setDates([...dates,""])}>日を追加</button>}
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <label>開始時間<input type="time" name="start_time" required defaultValue={start}/></label>
    <label>終了時間<input type="time" name="end_time" required defaultValue={end}/></label>
   </div>
   {state.error&&<p role="alert" className={styles.error}>{state.error}{state.error.includes("足りません")&&<> <Link href="/store/profile/plan#addons">ディーラースカウトを追加する</Link></>}</p>}
   {state.sent>0&&!state.error&&<p role="status">{state.sent}日分のオファーを送りました。日ごとのチャットは<Link href="/store/profile/dealer-chat">チャット一覧</Link>から確認できます。</p>}
   <Submit count={Math.max(1,filled)}/>
  </form></details>;
}

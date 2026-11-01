// キャンセルの記録(星の平均には入れず、回数と双方の言い分を別に出す。2026/10/22)
import {Stars} from "./stars";
import {cancelReasonLabel} from "@/lib/cancel-reasons";
export type CancelHistory={count:number;late:number;items:{work_start:string;cancelled_at:string;late:boolean|null;reason_code:string|null;reason:string|null;reply:string|null;reply_rating:number|null;reply_at:string|null;store_name:string|null}[]};
const date=(s:string)=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"medium",timeStyle:"short"}).format(new Date(s));
export function CancellationHistory({history,subject}:{history:CancelHistory|null;subject:"dealer"|"store"}){
 if(!history)return null;
 const other=subject==="dealer"?"店舗":"ディーラー";
 return <section style={{border:"1px solid #e4d3ad",borderRadius:12,padding:"14px 16px",margin:"16px 0",background:"#fffdf8"}}>
  <h2 style={{fontSize:16,margin:"0 0 6px"}}>確定後のキャンセル：{history.count}回{history.count>0?`（うち直前キャンセル ${history.late}回）`:""}</h2>
  <p style={{fontSize:12,color:"#7a6a52",margin:"0 0 8px"}}>勤務が確定したあとに{subject==="dealer"?"ディーラー":"店舗"}がキャンセルした回数です。勤務開始の3時間前を切ってからのキャンセルは「直前」です。星の平均には含みません。</p>
  {history.items.length>0&&<details><summary style={{cursor:"pointer",fontSize:13}}>キャンセルの理由と{other}の言い分を見る</summary>
   {history.items.map((c,i)=><div key={i} style={{borderTop:"1px solid #eee",padding:"10px 0",fontSize:13,lineHeight:1.7}}>
    <p style={{margin:0}}><strong>{date(c.work_start)}の勤務</strong>{c.late?"（直前キャンセル）":""}{subject==="dealer"&&c.store_name?`・${c.store_name}`:""}</p>
    <p style={{margin:"4px 0",whiteSpace:"pre-wrap"}}>理由：{cancelReasonLabel(c.reason_code)}　{c.reason}</p>
    {c.reply?<div style={{background:"#faf7ef",padding:"8px 10px",borderRadius:8}}><p style={{margin:0}}>{other}の言い分：<Stars rating={c.reply_rating}/></p><p style={{margin:"4px 0 0",whiteSpace:"pre-wrap"}}>{c.reply}</p></div>:<p style={{margin:0,color:"#7a6a52"}}>{other}の言い分はまだありません。</p>}
   </div>)}
  </details>}
 </section>;
}

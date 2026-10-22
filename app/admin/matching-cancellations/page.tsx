import {reportAccess} from "../dealer-chat-reports/access";
import {createServiceRoleClient} from "@/lib/supabase/service-role";
import {cancelReasonLabel} from "@/lib/cancel-reasons";
import {updateCancellation} from "./actions";
export const dynamic="force-dynamic";
const date=(s:string|null)=>s?new Date(s).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}):"";
// 勤務キャンセル(確定後)の一覧。揉めたときに運営が中身を見て、回数から外したり言い分を直したりする(2026/10/22)
export default async function Page({searchParams}:{searchParams:{saved?:string}}){
 await reportAccess();
 const svc=createServiceRoleClient();
 const {data,error}=await svc.from("dealer_matching_records")
  .select("id,status,work_start,cancellation_notice_at,cancel_late,cancel_reason_code,cancel_reason,cancel_reply,cancel_reply_rating,cancel_reply_at,cancel_excluded,cancel_admin_note,job_snapshot")
  .in("status",["store_cancelled","dealer_cancelled"]).order("cancellation_notice_at",{ascending:false}).limit(100);
 if(error)throw new Error("キャンセルを読み込めませんでした。");
 const area:React.CSSProperties={display:"block",width:"100%",minHeight:70,marginTop:4,boxSizing:"border-box"};
 return <div className="container">
  <h1 style={{fontSize:20,marginBottom:8}}>勤務キャンセル</h1>
  <p style={{color:"#666",marginBottom:16,fontSize:13}}>勤務が確定したあとのキャンセルです。勤務開始の3時間前を切ってからのものは「直前」です。言い分が食い違うときは中身を見て、やむを得ないものは回数から外せます（外すと、店舗・ディーラーの「確定後のキャンセル」の回数とディーラーのキャンセル率から除かれます）。</p>
  {searchParams.saved&&<p className="card" style={{marginBottom:12}}>保存しました。</p>}
  {(data??[]).map((r:any)=>{const j=r.job_snapshot||{};const by=r.status==="store_cancelled"?"店舗":"ディーラー";return <section key={r.id} id={"c-"+r.id} className="card" style={{marginBottom:12,opacity:r.cancel_excluded?0.65:1}}>
   <p style={{margin:0}}><strong>{j.store_name||"店舗"} ／ {j.dealer_name||"ディーラー"}</strong>　勤務 {date(r.work_start)}</p>
   <p style={{margin:"4px 0"}}>{by}がキャンセル（{date(r.cancellation_notice_at)}）{r.cancel_late?"・直前キャンセル":""}{r.cancel_excluded?"・回数から外し中":""}</p>
   <details><summary style={{cursor:"pointer"}}>理由・言い分を見る・直す</summary>
    <form action={updateCancellation} style={{marginTop:8}}>
     <input type="hidden" name="id" value={r.id}/><input type="hidden" name="op" value="edit"/>
     <label style={{display:"block",fontSize:13}}>{by}の理由（{cancelReasonLabel(r.cancel_reason_code)}）<textarea name="reason" defaultValue={r.cancel_reason||""} required maxLength={1000} style={area}/></label>
     <label style={{display:"block",fontSize:13,marginTop:8}}>{r.status==="store_cancelled"?"ディーラー":"店舗"}の言い分{r.cancel_reply_rating?`（星${r.cancel_reply_rating}）`:""}（空にすると言い分と星を消します）<textarea name="reply" defaultValue={r.cancel_reply||""} maxLength={1000} style={area}/></label>
     <label style={{display:"block",fontSize:13,marginTop:8}}>運営メモ<input name="note" defaultValue={r.cancel_admin_note||""} maxLength={1000} style={{display:"block",width:"100%"}}/></label>
     <button type="submit" className="btn" style={{marginTop:8}}>理由・言い分を保存する</button>
    </form>
   </details>
   <form action={updateCancellation} style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
    <input type="hidden" name="id" value={r.id}/><input type="hidden" name="op" value={r.cancel_excluded?"include":"exclude"}/>
    <input name="note" defaultValue={r.cancel_admin_note||""} placeholder="判断の理由（運営メモ）" maxLength={1000} style={{flex:1,minWidth:200}}/>
    <button type="submit" className="btn">{r.cancel_excluded?"回数に戻す":"やむを得ないので回数から外す"}</button>
   </form>
  </section>;})}
  {!data?.length&&<p>確定後のキャンセルはまだありません。</p>}
 </div>;
}

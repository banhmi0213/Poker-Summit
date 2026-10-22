"use server";
import {kickMatchingNotifications} from "@/lib/matching-notification-kick";
import { redirect } from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { createStoreClient } from "@/lib/supabase/store-server";
import { requireMatchingConsent } from "@/lib/matching-consent-server";
import { UUID,validDate } from "@/lib/spot-jobs";
export async function submitWork(_state:{error:string},form:FormData):Promise<{error:string}> {
 const actor=form.get("actor");
 if(actor!=="dealer"&&actor!=="store")return {error:"操作を確認してください。"};
 const path=actor==="dealer"?"/account/dealer/work":"/store/profile/spot-jobs/work";
 const db=actor==="dealer"?await createClient():await createStoreClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect((actor==="dealer"?"/login":"/store/login")+"?next="+encodeURIComponent(path));
 await requireMatchingConsent(db,user.id,actor,path);
 const operation=String(form.get("operation")||"");
 if(operation==="confirm"){const id=String(form.get("id")||"");if(!UUID.test(id))return {error:"勤務を確認してください。"};redirect((actor==="store"?"/store/profile/dealer-chat/":"/account/dealer/chat/")+id);}
 let error; let recordId="";
 if(operation==="request"){
  const job=String(form.get("job")||""),date=String(form.get("date")||"");
  if(actor!=="dealer"||!UUID.test(job)||!validDate(date))return {error:"勤務日を確認してください。"};
  const result=await db.rpc("request_spot_work",{p_job_id:job,p_work_date:date});
  error=result.error; recordId=String(result.data||"");
 }else{
  const id=String(form.get("id")||"");
  if(!UUID.test(id)||!["confirm","review","complete"].includes(operation))return {error:"勤務を確認してください。"};
  recordId=id;
  const review=String(form.get("review")||"").trim();
  if(operation==="review"&&(!review||review.length>2000))return {error:"レビューは1〜2000文字で記載してください。"};
  const rating=Number(form.get("rating"));
  if(operation==="review"&&(!Number.isInteger(rating)||rating<1||rating>5))return {error:"星評価を1〜5で選択してください。"};
  ({error}=await db.rpc(operation==="review"?"update_spot_work_with_rating":"update_spot_work",{p_record_id:id,p_actor:actor,p_operation:operation,p_review:operation==="review"?review:null,...(operation==="review"?{p_rating:rating}:{})}));
 }
 if(error)return {error:"保存できませんでした。募集状況・勤務終了時刻・レビューの保存を確認し、ページを更新して再度お試しください。"};
 for(const p of ["/account/dealer","/store/profile/spot-jobs","/store/profile/dealers","/spot-jobs"])revalidatePath(p,"layout");
 if(operation==="request"){await kickMatchingNotifications(recordId,db);redirect("/account/dealer/chat/"+recordId);}
 redirect(path+"?saved=1&record="+encodeURIComponent(recordId));
}

// 確定後の勤務キャンセル(理由必須)と、キャンセルされた側の言い分(2026/10/22)
export async function cancelWork(_state:{error:string},form:FormData):Promise<{error:string}>{
 const actor=form.get("actor");
 if(actor!=="dealer"&&actor!=="store")return {error:"操作を確認してください。"};
 const path=actor==="dealer"?"/account/dealer/work":"/store/profile/spot-jobs/work";
 const db=actor==="dealer"?await createClient():await createStoreClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect((actor==="dealer"?"/login":"/store/login")+"?next="+encodeURIComponent(path));
 await requireMatchingConsent(db,user.id,actor,path);
 const id=String(form.get("id")||""),code=String(form.get("code")||""),reason=String(form.get("reason")||"").trim();
 if(!UUID.test(id))return {error:"勤務を確認してください。"};
 if(!code)return {error:"キャンセルの理由を選んでください。"};
 if(!reason||reason.length>1000)return {error:"キャンセルの理由を1〜1000文字で書いてください。"};
 if(form.get("agreed")!=="on")return {error:"注意事項を確認してチェックを入れてください。"};
 const {error}=await db.rpc("cancel_spot_work",{p_record:id,p_actor:actor,p_code:code,p_reason:reason});
 if(error)return {error:error.code==="P0001"?error.message:"キャンセルできませんでした。ページを更新して再度お試しください。"};
 await kickMatchingNotifications(id,db);
 for(const p of ["/account/dealer","/store/profile/spot-jobs","/store/profile/dealers","/spot-jobs"])revalidatePath(p,"layout");
 redirect(path+"?saved=1&record="+encodeURIComponent(id));
}
export async function replyCancel(_state:{error:string},form:FormData):Promise<{error:string}>{
 const actor=form.get("actor");
 if(actor!=="dealer"&&actor!=="store")return {error:"操作を確認してください。"};
 const path=actor==="dealer"?"/account/dealer/work":"/store/profile/spot-jobs/work";
 const db=actor==="dealer"?await createClient():await createStoreClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect((actor==="dealer"?"/login":"/store/login")+"?next="+encodeURIComponent(path));
 const id=String(form.get("id")||""),comment=String(form.get("comment")||"").trim(),rating=Number(form.get("rating"));
 if(!UUID.test(id))return {error:"勤務を確認してください。"};
 if(!Number.isInteger(rating)||rating<1||rating>5)return {error:"星評価を1〜5で選んでください。"};
 if(!comment||comment.length>1000)return {error:"1〜1000文字で書いてください。"};
 const {error}=await db.rpc("reply_spot_cancel",{p_record:id,p_actor:actor,p_rating:rating,p_comment:comment});
 if(error)return {error:error.code==="P0001"?error.message:"保存できませんでした。"};
 for(const p of ["/account/dealer","/store/profile/spot-jobs","/store/profile/dealers","/spot-jobs"])revalidatePath(p,"layout");
 redirect(path+"?saved=1&record="+encodeURIComponent(id));
}

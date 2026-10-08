"use server";
import {kickMatchingNotifications} from "@/lib/matching-notification-kick";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {createStoreClient} from "@/lib/supabase/store-server";
import {requireMatchingConsent} from "@/lib/matching-consent-server";
import {UUID,validDate} from "@/lib/spot-jobs";
export type ChatState={error:string;success:number};
export async function chatAction(previous:ChatState,form:FormData):Promise<ChatState>{
 const actor=form.get("actor"),record=String(form.get("record")||"");
 if((actor!=="store"&&actor!=="dealer")||!UUID.test(record))return {error:"チャットを確認してください。",success:previous.success};
 const path=(actor==="store"?"/store/profile/dealer-chat/":"/account/dealer/chat/")+record;
 const db=actor==="store"?await createStoreClient():await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect((actor==="store"?"/store/login":"/login")+"?next="+encodeURIComponent(path));
 await requireMatchingConsent(db,user.id,actor,path);
 const operation=String(form.get("operation")||"");
 if(!["consent","send","terms","confirm","report","block","unblock"].includes(operation))return {error:"操作を確認してください。",success:previous.success};
 if(["consent","confirm","block"].includes(operation)&&form.get("agreed")!=="on")return {error:"内容を確認してチェックしてください。",success:previous.success};
 const payload:Record<string,string>={};
 for(const key of ["body","nonce","revision","contract_type","payment_method","payment_date","notes","reason"])payload[key]=String(form.get(key)||"");
 if(operation==="send"&&(!UUID.test(payload.nonce)||!payload.body.trim()||payload.body.length>2000))return {error:"メッセージは1〜2000文字で記載してください。",success:previous.success};
 const {error}=await db.rpc("dealer_chat_operation",{p_record:record,p_operation:operation,p_payload:payload});
 if(error)return {error:error.code==="P0001"?error.message:"保存できませんでした。ページを更新して再度お試しください。",success:previous.success};
 if(operation==="send")await kickMatchingNotifications(record,db);
 revalidatePath(path);
 revalidatePath(actor==="store"?"/store/profile/spot-jobs/work":"/account/dealer/work");
 return {error:"",success:previous.success+1};
}
export async function offerAction(previous:ChatState,form:FormData):Promise<ChatState>{
 const dealer=String(form.get("dealer")||""),[job,date]=String(form.get("shift")||"").split("|");
 if(!UUID.test(dealer)||!UUID.test(job||"")||!validDate(date||""))return {error:"勤務日を選んでください。",success:previous.success};
 const db=await createStoreClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/store/login");
 await requireMatchingConsent(db,user.id,"store","/store/profile/dealers/"+dealer);
 const {data,error}=await db.rpc("offer_spot_work",{p_dealer:dealer,p_job:job,p_date:date});
 if(error||!UUID.test(String(data)))return {error:error?.code==="P0001"?error.message:"オファーを保存できませんでした。",success:previous.success};
 await kickMatchingNotifications(String(data),db);
 redirect("/store/profile/dealer-chat/"+data);
}

export async function markNotificationsRead(actor:"store"|"dealer",record:string,events:string[]){
 if(!["store","dealer"].includes(actor)||!UUID.test(record)||events.length>51||events.some(id=>!UUID.test(id)))return;
 const db=actor==="store"?await createStoreClient():await createClient();
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 await db.rpc("mark_matching_notifications",{p_record:record,p_events:events});
}

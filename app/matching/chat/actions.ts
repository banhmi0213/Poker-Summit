"use server";
import {kickMatchingNotifications} from "@/lib/matching-notification-kick";
import {redirect} from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import {createClient} from "@/lib/supabase/server";
import {createStoreClient} from "@/lib/supabase/store-server";
import {requireMatchingConsent} from "@/lib/matching-consent-server";
import {UUID,validDate} from "@/lib/spot-jobs";
import {normalizeDealerPhone,validDealerContacts} from "@/lib/dealer-contacts";
export type ChatState={error:string;success:number};
export async function saveChatContacts(previous:ChatState,form:FormData):Promise<ChatState>{
 const record=String(form.get("record")||"");if(!UUID.test(record))return {error:"チャットを確認してください。",success:previous.success};
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/login");
 const path="/account/dealer/chat/"+record;await requireMatchingConsent(db,user.id,"dealer",path);
 const room=await db.from("dealer_matching_records").select("id").eq("id",record).eq("dealer_user_id",user.id).maybeSingle();
 if(room.error||!room.data)return {error:"チャットを確認できません。",success:previous.success};
 const phone=normalizeDealerPhone(String(form.get("phone")||"")),kind=String(form.get("contact_type")||""),value=String(form.get("contact_value")||"").trim();
 if(form.get("agreed")!=="on"||!validDealerContacts(phone,kind,value,true))return {error:"連絡先を入力し、開示に同意してください。",success:previous.success};
 const result=await db.from("dealer_private_contacts").upsert({user_id:user.id,phone,contact_type:kind,contact_value:value,disclosure_consented_at:new Date().toISOString()},{onConflict:"user_id"});
 if(result.error)return {error:"連絡先を保存できませんでした。",success:previous.success};
 revalidatePath(path);revalidatePath("/store/profile/dealer-chat/"+record);revalidatePath("/account/dealer/edit");
 return {error:"",success:previous.success+1};
}
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
 if(operation==="confirm"&&actor==="dealer"){
  const result=await db.from("dealer_private_contacts").select("phone,contact_value,disclosure_consented_at,disclosure_version").eq("user_id",user.id).maybeSingle();
  if(result.error||!result.data?.phone||!result.data.contact_value||!result.data.disclosure_consented_at||result.data.disclosure_version!=="2026-10-07-contact-v1")return {error:"先に、このチャット下部で連絡先を登録し、開示に同意してください。",success:previous.success};
 }
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

// 求人を作らずに、条件を書いてディーラーへ直接オファーする(2026/10/22 オーナー指示)。
// 条件は非公開の「スカウト用の求人」として残り、次のオファー・求人の入力欄に前回の内容として入る。
export async function offerDirectAction(previous:ChatState,form:FormData):Promise<ChatState>{
 const dealer=String(form.get("dealer")||""),date=String(form.get("work_date")||"");
 const start=String(form.get("start_time")||""),end=String(form.get("end_time")||"");
 const wage=Number.parseInt(String(form.get("hourly_wage")||""),10);
 const games=form.getAll("games").map(String).filter(Boolean).slice(0,20);
 const transport=String(form.get("transport_type")||"none");
 const limitRaw=String(form.get("transport_limit")||"");
 const fail=(error:string)=>({error,success:previous.success});
 if(!UUID.test(dealer))return fail("ディーラーを確認してください。");
 if(!validDate(date))return fail("勤務日を選んでください。");
 if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))return fail("開始時間と終了時間を入力してください。");
 if(!Number.isFinite(wage)||wage<1||wage>100000)return fail("時給を入力してください。");
 if(!games.length)return fail("ゲーム種目を選んでください。");
 if(!["none","full","limited"].includes(transport))return fail("交通費を選んでください。");
 const db=await createStoreClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/store/login");
 await requireMatchingConsent(db,user.id,"store","/store/profile/dealers/"+dealer);
 const {data,error}=await db.rpc("offer_direct_work",{
  p_dealer:dealer,p_date:date,p_start:start,p_end:end,p_wage:wage,p_games:games,
  p_duties:String(form.get("duties")||"").slice(0,3000),p_requirements:String(form.get("requirements")||"").slice(0,3000),
  p_transport_type:transport,p_transport_limit:transport==="limited"?Number.parseInt(limitRaw,10)||0:null,
  p_dress:String(form.get("dress")||"").slice(0,2000),
  p_terms:{contract_type:String(form.get("contract_type")||""),payment_method:String(form.get("payment_method")||""),payment_date:String(form.get("payment_date")||"").slice(0,100),notes:String(form.get("contract_notes")||"").slice(0,2000)},
 });
 if(error||!UUID.test(String(data)))return fail(error?.code==="P0001"?error.message:"オファーを送れませんでした。");
 await kickMatchingNotifications(String(data),db);
 redirect("/store/profile/dealer-chat/"+data);
}

// チャットから同じディーラーに別の日も頼む(2026/10/22)。勤務日1日ごとに1回。
export type MoreDaysState={error:string;sent:number};
export async function offerMoreDaysAction(previous:MoreDaysState,form:FormData):Promise<MoreDaysState>{
 const record=String(form.get("record")||"");
 const dates=Array.from(new Set(form.getAll("dates").map(String).filter(Boolean)));
 const start=String(form.get("start_time")||""),end=String(form.get("end_time")||"");
 if(!UUID.test(record))return {error:"チャットを確認してください。",sent:previous.sent};
 if(!dates.length||dates.length>14||dates.some(d=>!validDate(d)))return {error:"頼む日を1〜14日選んでください。",sent:previous.sent};
 if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))return {error:"開始時間と終了時間を入力してください。",sent:previous.sent};
 const db=await createStoreClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/store/login");
 await requireMatchingConsent(db,user.id,"store","/store/profile/dealer-chat/"+record);
 const {data,error}=await db.rpc("offer_more_days",{p_record:record,p_dates:dates,p_start:start,p_end:end});
 if(error)return {error:error.code==="P0001"?error.message:"オファーを送れませんでした。",sent:previous.sent};
 const ids=(data as string[]|null)??[];
 for(const id of ids)await kickMatchingNotifications(id,db);
 await kickMatchingNotifications(record,db);
 revalidatePath("/store/profile/dealer-chat","layout");
 return {error:"",sent:ids.length};
}

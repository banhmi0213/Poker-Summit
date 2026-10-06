"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/audit";
export async function saveTournament(_: {error?:string;success?:string;id?:string}, form:FormData): Promise<{error?:string;success?:string;id?:string}> {
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 const {data:admin,error:authError}=await db.rpc("is_admin");
 if(!user||authError||admin!==true)return {error:"運営権限がありません。"};
 const get=(key:string)=>String(form.get(key)||"").trim();
 const id=get("id"),title=get("title"),scope=get("scope"),location=get("location"),venue=get("venue"),description=get("description"),schedule=get("schedule"),official_url=get("official_url");
 if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return {error:"大会が見つかりません。"};
 if(!title||title.length>160||!["国内","海外"].includes(scope)||location.length>200||venue.length>300||description.length>10000||schedule.length>20000)return {error:"入力内容と文字数を確認してください。"};
 if(official_url){try{const u=new URL(official_url);if(!["https:","http:"].includes(u.protocol)||u.username||u.password||official_url.length>2048)throw Error();}catch{return {error:"公式URLは https:// または http:// で入力してください。"};}}
 const start_date=get("start_date")||null,end_date=get("end_date")||null;
 for(const date of [start_date,end_date])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))return {error:"開催日を確認してください。"};
 if(start_date&&end_date&&end_date<start_date)return {error:"終了日は開始日以降を選択してください。"};
 const intent=get("intent");
 if(!["draft","publish"].includes(intent))return {error:"保存方法を選択してください。"};
 if(intent==="publish"&&!schedule)return {error:"公開する大会のスケジュールを入力してください。"};
 const values={title,scope,location,venue,description,schedule,official_url,start_date,end_date,active:intent==="publish",updated_at:new Date().toISOString()};
 const query=id?db.from("major_tournaments").update(values).eq("id",id):db.from("major_tournaments").insert(values);
 const {data,error}=await query.select("id").single();
 if(error||!data)return {error:"大会を保存できませんでした。もう一度お試しください。"};
 await logAdminAction(db,id?"major_tournament_update":"major_tournament_create","major_tournament",data.id,{title,active:values.active});
 revalidatePath("/admin/major-tournaments");revalidatePath("/major-tournaments");revalidatePath(`/major-tournaments/${data.id}`);
 return {success:values.active?"大会を公開しました。":"下書きを保存しました。",id:data.id};
}

export async function deleteTournament(_: {error?:string}, form:FormData): Promise<{error?:string}> {
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 const {data:admin,error:authError}=await db.rpc("is_admin");
 if(!user||authError||admin!==true)return {error:"運営権限がありません。"};
 const id=String(form.get("id")||"").trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return {error:"大会が見つかりません。"};
 const {data,error}=await db.from("major_tournaments").delete().eq("id",id).select("id,title").maybeSingle();
 if(error||!data)return {error:"大会を削除できませんでした。最新の一覧を確認して、もう一度お試しください。"};
 await logAdminAction(db,"major_tournament_delete","major_tournament",data.id,{title:data.title});
 revalidatePath("/admin/major-tournaments");
 revalidatePath("/major-tournaments");
 revalidatePath(`/major-tournaments/${data.id}`);
 redirect("/admin/major-tournaments?deleted=1");
}

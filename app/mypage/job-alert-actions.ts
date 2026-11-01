"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function saveJobAlertPreferences(formData: FormData) {
 const db = await createClient();
 const {data:{user}}=await db.auth.getUser();
 if (!user) throw new Error("ログインしてください。");
 const pref=String(formData.get("pref")||"");
 const experience=String(formData.get("experience")||"any");
 if (!["any","beginner","experienced"].includes(experience)) throw new Error("経験条件が不正です。");
 const enabled=formData.get("enabled")==="on";
 const {data:existing,error:readError}=await db.from("job_alert_preferences").select("enabled,subscribed_at").eq("user_id",user.id).maybeSingle();
 if (readError) throw new Error(readError.message);
 const {error}=await db.from("job_alert_preferences").upsert({
   user_id:user.id,enabled,pref:pref||null,experience_level:experience,
   subscribed_at: enabled && !existing?.enabled ? new Date().toISOString() : existing?.subscribed_at || new Date().toISOString(),
   updated_at:new Date().toISOString()
 },{onConflict:"user_id"});
 if(error) throw new Error(error.message);
 revalidatePath("/mypage");
}

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function setFavoriteEvent(eventId:string,saved:boolean) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) throw new Error("イベント情報が正しくありません。");
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
  const suspension=await supabase.rpc("is_suspended");
  if(suspension.error) throw new Error("会員情報を確認できませんでした。");
  if(suspension.data) redirect("/account/suspended");
  if(saved) {
    const {data:event,error}=await supabase.from("events").select("id").eq("id",eventId).eq("status","published").maybeSingle();
    if(error || !event) throw new Error("イベントを保存できませんでした。");
    const result=await supabase.from("favorite_events").insert({user_id:user.id,event_id:eventId});
    if(result.error && result.error.code!=="23505") throw new Error("お気に入りを保存できませんでした。");
  } else {
    const result=await supabase.from("favorite_events").delete().eq("user_id",user.id).eq("event_id",eventId);
    if(result.error) throw new Error("お気に入りを解除できませんでした。");
  }
  revalidatePath(`/events/${eventId}`);
}

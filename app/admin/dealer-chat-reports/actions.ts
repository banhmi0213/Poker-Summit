"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {UUID} from "@/lib/spot-jobs";
export async function resolveReport(form:FormData){
 const id=String(form.get("id")||"");if(!UUID.test(id))throw new Error("通報を確認してください。");
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/admin-login");
 const {error}=await db.rpc("resolve_dealer_chat_report",{p_report:id});if(error)throw new Error("対応状況を保存できませんでした。");
 revalidatePath("/admin/dealer-chat-reports","layout");
 redirect("/admin/dealer-chat-reports/"+id+"?saved=1");
}

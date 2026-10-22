"use server";
// 勤務キャンセルの運営対応(2026/10/22): 回数から外す/戻す、理由・言い分を直す・消す
import {redirect} from "next/navigation";
import {revalidatePath} from "@/lib/revalidate";
import {reportAccess} from "../dealer-chat-reports/access";
import {createServiceRoleClient} from "@/lib/supabase/service-role";
import {logAdminAction} from "@/lib/audit";
import {UUID} from "@/lib/spot-jobs";

export async function updateCancellation(form:FormData){
 const db=await reportAccess();
 const id=String(form.get("id")||"");if(!UUID.test(id))throw new Error("勤務を確認してください。");
 const op=String(form.get("op")||"");
 const svc=createServiceRoleClient();
 const note=String(form.get("note")||"").trim().slice(0,1000)||null;
 let patch:Record<string,unknown>={};
 if(op==="exclude")patch={cancel_excluded:true,cancel_admin_note:note};
 else if(op==="include")patch={cancel_excluded:false,cancel_admin_note:note};
 else if(op==="edit"){
  const reason=String(form.get("reason")||"").trim(),reply=String(form.get("reply")||"").trim();
  if(!reason||reason.length>1000||reply.length>1000)throw new Error("理由は1〜1000文字、言い分は1000文字以内で入力してください。");
  patch={cancel_reason:reason,cancel_reply:reply||null,...(reply?{}:{cancel_reply_rating:null,cancel_reply_at:null}),cancel_admin_note:note};
 }else throw new Error("操作を確認してください。");
 const {error}=await svc.from("dealer_matching_records").update(patch).eq("id",id).in("status",["store_cancelled","dealer_cancelled"]);
 if(error)throw new Error("保存できませんでした: "+error.message);
 await logAdminAction(db,"matching_cancellation_"+op,"dealer_matching_record",id,{note});
 revalidatePath("/admin/matching-cancellations");
 redirect("/admin/matching-cancellations?saved=1#c-"+id);
}

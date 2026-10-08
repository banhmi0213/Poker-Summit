import 'server-only';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
type Delivery={notification_id:string;channel:'line'|'email';lock_token:string;recipient_actor:'store'|'dealer';kind:'application'|'offer'|'message';record_id:string;recipient_email:string|null;line_user_id:string|null};
export function notificationText(item:Pick<Delivery,'recipient_actor'|'kind'|'record_id'>){const title=item.kind==='application'?'スポット求人に新しい応募がありました':item.kind==='offer'?'店舗から新しい勤務オファーが届きました':'勤務のチャットに新しいメッセージが届きました';const path=item.recipient_actor==='store'?'/store/profile/dealer-chat/':'/account/dealer/chat/';return {subject:`【Poker Summit】${title}`,text:`【Poker Summit】${title}。\n\n内容はこちらから確認してください。\nhttps://pokersummit.jp${path}${item.record_id}\n\n通知にはチャット本文・非公開連絡先を掲載していません。`};}
export async function deliverMatchingNotifications(record:string|null=null){
 const db=createServiceRoleClient();const {data,error}=await db.rpc('claim_matching_notifications',{p_record:record});if(error)throw new Error('Notification claim failed');
 const results=await Promise.all((data as Delivery[]||[]).map(async item=>{
  let state:'sent'|'skipped'|'pending'='pending',detail:string|null=null;
  const content=notificationText(item);
  try{
   const token=item.channel==='line'?process.env.LINE_CHANNEL_ACCESS_TOKEN:process.env.RESEND_API_KEY;
   const recipient=item.channel==='line'?item.line_user_id:item.recipient_email;
   if(!recipient){state='skipped';detail='recipient_unavailable';}
   else if(!token){detail='configuration_missing';}
   else{
    const response=await fetch(item.channel==='line'?'https://api.line.me/v2/bot/message/push':'https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...(item.channel==='line'?{'X-Line-Retry-Key':item.notification_id}:{'Idempotency-Key':item.notification_id})},body:JSON.stringify(item.channel==='line'?{to:recipient,messages:[{type:'text',text:content.text}]}:{from:'Poker Summit <info@pokersummit.jp>',to:[recipient],subject:content.subject,text:content.text}),signal:AbortSignal.timeout(6000),cache:'no-store'});
    // LINE 409 means this same retry key was accepted previously.
    if(response.ok||(item.channel==='line'&&response.status===409))state='sent';else detail=`provider_http_${response.status}`;
   }
  }catch{detail='delivery_connection_failed';}
  const saved=await db.rpc('finish_matching_notification',{p_notification:item.notification_id,p_channel:item.channel,p_lock:item.lock_token,p_state:state,p_error:detail});
  return saved.error?'pending':state;
 }));
 return {processed:results.length,sent:results.filter(r=>r==='sent').length,pending:results.filter(r=>r==='pending').length,skipped:results.filter(r=>r==='skipped').length};
}

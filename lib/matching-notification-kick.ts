import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
// The verified session stays on the server. Delivery runs in a cron/API worker,
// separate from user-session writes and their RLS authorization.
export async function kickMatchingNotifications(record:string,db:SupabaseClient){
 const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return;
 try{await fetch('https://pokersummit.jp/api/cron/matching-notifications',{method:'POST',headers:{authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:JSON.stringify({record}),cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{/* Atomic outbox remains pending; next request/daily cron retries. */}
}

import 'server-only';
import {gtoUsageDatabaseReady} from './gto-usage-environment';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {usageReport,type UsageEvent,type UsagePeriod} from './gto-usage';
export async function isUsageAdmin(){
 const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return false;
 const {data,error}=await auth.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();return !error&&!!data;
}
export async function loadUsage(period:UsagePeriod){
 if(!gtoUsageDatabaseReady())throw new Error('このPreviewはステージングDBに接続されていません。VercelのPreview用DB設定を確認してください。');
 const svc=createServiceRoleClient();
 const {data:first,error:firstError}=await svc.from('gto_usage_events').select('created_at').order('created_at').limit(1).maybeSingle();
 if(firstError)throw new Error('利用記録を読み込めませんでした。DBの準備状況をご確認ください。');
 const rows:UsageEvent[]=[];
 // Keyset pagination avoids PostgREST's 1,000-row truncation and offset drift during writes.
 let after:string|null=null;
 const until=new Date(Math.min(period.end,Date.now())).toISOString();
 for(;;){
  let q=svc.from('gto_usage_events').select('id,created_at,visitor_id,member_id,tool,action,device').gte('created_at',new Date(Math.min(period.trendStart,period.previous)).toISOString()).lt('created_at',until).order('id').limit(1000);
  if(after)q=q.gt('id',after);
  const {data,error}=await q;if(error)throw new Error('利用記録の読み込みに失敗しました。もう一度お試しください。');
  rows.push(...(data??[]) as UsageEvent[]);if(!data||data.length<1000)break;after=data[data.length-1].id;
 }
 return {report:usageReport(rows,period),startedAt:first?.created_at as string|undefined};
}

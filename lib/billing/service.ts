import 'server-only';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {GTO_PRICES,GTO_TRIAL_DAYS,KOMOJU_PERIOD,type BillingPeriod,type PaidTier} from './plans';
import {cancelPlan,statusFromKomoju,trialDue,type PlanStatus} from './state';
import {createCustomerSession,createSubscription,deleteSubscription,getSession,getSubscription,sessionCustomerId,KomojuError} from './komoju';

/** Server-side GTO plan operations. Every write goes through the service role; members only read their own status. */
type Row={id:string;member_id:string;tier:PaidTier;period:BillingPeriod;status:PlanStatus;komoju_session_id:string|null;komoju_customer_id:string|null;
 komoju_subscription_id:string|null;trial_ends_at:string|null;current_period_end:string|null;cancel_at_period_end:boolean};
const db=()=>createServiceRoleClient();
const OPEN=['pending','trialing','active','past_due'];
async function openPlan(member:string):Promise<Row|null>{
 const {data,error}=await db().from('gto_member_plans').select('*').eq('member_id',member).in('status',OPEN).maybeSingle();
 if(error)throw new Error('plan_read_failed');return data as Row|null;
}
async function update(id:string,patch:Partial<Row>&{canceled_at?:string|null}){
 const {error}=await db().from('gto_member_plans').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw new Error('plan_write_failed');
}

/** Step 1: open KOMOJU's card page. Nothing is charged; the 3-day trial starts when the card is saved. */
export async function startCheckout(member:string,email:string|null,tier:PaidTier,period:BillingPeriod,origin:string){
 const existing=await openPlan(member);
 if(existing&&existing.status!=='pending')return {error:'already_subscribed' as const};
 if(existing)await update(existing.id,{status:'canceled',canceled_at:new Date().toISOString()});
 const {data,error}=await db().from('gto_member_plans').insert({member_id:member,tier,period,status:'pending'}).select('id').single();
 if(error||!data)throw new Error('plan_write_failed');
 const ref=(data as {id:string}).id;
 const session=await createCustomerSession({returnUrl:`${origin}/api/billing/gto/return?ref=${ref}`,email,reference:ref});
 if(!session.session_url)throw new KomojuError(0,'no_session_url');
 await update(ref,{komoju_session_id:session.id});
 return {url:session.session_url};
}

/** Step 2: back from KOMOJU. A completed session gives the customer; the trial starts now. */
export async function completeCheckout(member:string,ref:string){
 const {data}=await db().from('gto_member_plans').select('*').eq('id',ref).eq('member_id',member).maybeSingle();
 const row=data as Row|null;if(!row)return 'not_found' as const;
 if(row.status!=='pending')return row.status==='trialing'||row.status==='active'?'ok' as const:'not_found' as const;
 if(!row.komoju_session_id)return 'not_found' as const;
 const session=await getSession(row.komoju_session_id);
 const customer=sessionCustomerId(session);
 if(session.status!=='completed'||!customer)return 'not_completed' as const;
 await update(row.id,{status:'trialing',komoju_customer_id:customer,trial_ends_at:new Date(Date.now()+GTO_TRIAL_DAYS*86400000).toISOString()});
 return 'ok' as const;
}

/** Cancel: free during the trial; while paying, KOMOJU stops and access lasts until the paid period ends. */
export async function cancelMemberPlan(member:string){
 const row=await openPlan(member);if(!row)return 'none' as const;
 const next=cancelPlan(row,Date.now());
 if(next.stopKomoju&&row.komoju_subscription_id){
  try{await deleteSubscription(row.komoju_subscription_id);}catch(e){if(!(e instanceof KomojuError&&e.status===404))throw e;}
 }
 await update(row.id,{status:next.status,cancel_at_period_end:next.cancel_at_period_end,canceled_at:new Date().toISOString()});
 return 'ok' as const;
}

/** Bring one plan in line with KOMOJU's view of its subscription. */
export async function syncSubscription(subscriptionId:string){
 const {data}=await db().from('gto_member_plans').select('*').eq('komoju_subscription_id',subscriptionId).maybeSingle();
 const row=data as Row|null;if(!row)return 'unknown' as const;
 if(row.status==='canceled')return 'ok' as const; // our own cancel already settled access
 const sub=await getSubscription(subscriptionId);
 const status=statusFromKomoju(sub.status);
 await update(row.id,{status:status==='pending'?row.status:status,current_period_end:sub.next_capture_at??row.current_period_end});
 return 'ok' as const;
}
/** Same, starting from a KOMOJU customer id (payment webhooks carry the customer). */
export async function syncCustomer(customerId:string){
 const {data}=await db().from('gto_member_plans').select('komoju_subscription_id').eq('komoju_customer_id',customerId).not('komoju_subscription_id','is',null).in('status',['active','past_due']);
 for(const r of (data??[]) as {komoju_subscription_id:string}[])await syncSubscription(r.komoju_subscription_id);
}

/** Cron: trials that ended become paid subscriptions (KOMOJU takes the first payment at once). */
export async function chargeEndedTrials(limit=50){
 const {data,error}=await db().from('gto_member_plans').select('*').eq('status','trialing').lte('trial_ends_at',new Date().toISOString()).limit(limit);
 if(error)throw new Error('plan_read_failed');
 let started=0,failed=0;
 for(const row of (data??[]) as Row[]){
  if(!trialDue(row,Date.now())||!row.komoju_customer_id)continue;
  try{
   const sub=await createSubscription({customer:row.komoju_customer_id,amount:GTO_PRICES[row.tier][row.period],period:KOMOJU_PERIOD[row.period],metadata:{plan:row.id,tier:row.tier,period:row.period}});
   const status=statusFromKomoju(sub.status);
   await update(row.id,{komoju_subscription_id:sub.id,status:status==='pending'?'active':status,current_period_end:sub.next_capture_at??null});
   if(status==='canceled')failed++;else started++;
  }catch{failed++;await update(row.id,{status:'canceled',canceled_at:new Date().toISOString()}).catch(()=>{});} // card declined at the end of the trial: no access, the member can start again
 }
 return {started,failed};
}

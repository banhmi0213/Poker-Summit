import 'server-only';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {GTO_TIER_LABEL,GTO_TRIAL_DAYS,KOMOJU_PERIOD,PRO_PRICE_CHANGE_AT,PRO_PRICE_VERSION,laterPrice,priceAt,yen,type BillingPeriod,type PaidTier} from './plans';
import {cancelPlan,noticesDue,priceSwitchDue,statusFromKomoju,trialDue,type PlanStatus} from './state';
import {PRO_ROADMAP} from './pro-roadmap';
import {sendGtoBillingAlertEmail,sendGtoPriceNoticeEmail} from '@/lib/email';
import {createCustomerSession,createSubscription,deleteSubscription,getSession,getSubscription,sessionCustomerId,KomojuError} from './komoju';

/** Server-side GTO plan operations. Every write goes through the service role; members only read their own status. */
type Row={id:string;member_id:string;tier:PaidTier;period:BillingPeriod;status:PlanStatus;komoju_session_id:string|null;komoju_customer_id:string|null;
 komoju_subscription_id:string|null;komoju_amount:number|null;trial_ends_at:string|null;current_period_end:string|null;cancel_at_period_end:boolean;
 price_switch_state:string|null;price_ack_version:string|null;price_ack_at:string|null};
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
/** `priceAck`: プロ needs the member to confirm the price-change date and the new price; it is stored with the plan row. */
export async function startCheckout(member:string,email:string|null,tier:PaidTier,period:BillingPeriod,origin:string,priceAck:boolean){
 if(tier==='pro'&&!priceAck)return {error:'price_ack_required' as const};
 const existing=await openPlan(member);
 if(existing&&existing.status!=='pending')return {error:'already_subscribed' as const};
 if(existing)await update(existing.id,{status:'canceled',canceled_at:new Date().toISOString()});
 const {data,error}=await db().from('gto_member_plans').insert({member_id:member,tier,period,status:'pending',...(tier==='pro'?{price_ack_version:PRO_PRICE_VERSION,price_ack_at:new Date().toISOString(),price_ack_shown:{now:priceAt(tier,period,Date.now()),later:laterPrice(tier,period),changeAt:new Date(PRO_PRICE_CHANGE_AT).toISOString()}}:{})}).select('id').single();
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
 await update(row.id,{status:status==='pending'?row.status:status,current_period_end:sub.next_capture_at??row.current_period_end,...(typeof sub.amount==='number'?{komoju_amount:sub.amount}:{})});
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
   const amount=priceAt(row.tier,row.period,Date.now());
   const sub=await createSubscription({customer:row.komoju_customer_id,amount,period:KOMOJU_PERIOD[row.period],metadata:{plan:row.id,tier:row.tier,period:row.period,product:`GTO ${GTO_TIER_LABEL[row.tier]}`}});
   const status=statusFromKomoju(sub.status);
   await update(row.id,{komoju_subscription_id:sub.id,komoju_amount:amount,status:status==='pending'?'active':status,current_period_end:sub.next_capture_at??null});
   if(status==='canceled')failed++;else started++;
  }catch{failed++;await update(row.id,{status:'canceled',canceled_at:new Date().toISOString()}).catch(()=>{});} // card declined at the end of the trial: no access, the member can start again
 }
 return {started,failed};
}

/** Cron: move プロ subscriptions to the new price shortly before their first charge on/after the change day.
 * Steps are recorded on the row (price_switch_state) so a crash never charges twice:
 *  'deleting' — the old subscription is being stopped (safe to retry: deleting twice is harmless);
 *  'creating' — the new one is being created. A row left in 'creating' is NOT retried automatically (KOMOJU may already
 *   have charged); it is reported to the admin to check by hand. */
export async function switchPrices(limit=50){
 const now=Date.now(),soon=new Date(now+4*3600000).toISOString();
 const {data,error}=await db().from('gto_member_plans').select('*').eq('status','active').not('komoju_subscription_id','is',null).is('price_switch_state',null).lte('current_period_end',soon).gte('current_period_end',new Date(now).toISOString()).limit(limit);
 if(error)throw new Error('plan_read_failed');
 let switched=0,failed=0;
 for(const row of (data??[]) as Row[]){
  const {due,newAmount}=priceSwitchDue(row,now);if(!due||!row.komoju_customer_id)continue;
  // Claim the row (only one cron run can).
  const {data:claimed}=await db().from('gto_member_plans').update({price_switch_state:'deleting',updated_at:new Date().toISOString()}).eq('id',row.id).is('price_switch_state',null).select('id');
  if(!claimed?.length)continue;
  const old=row.komoju_subscription_id!;
  try{
   try{await deleteSubscription(old);}catch(e){if(!(e instanceof KomojuError&&e.status===404))throw e;}
   await update(row.id,{price_switch_state:'creating'});
   const sub=await createSubscription({customer:row.komoju_customer_id,amount:newAmount,period:KOMOJU_PERIOD[row.period],metadata:{plan:row.id,tier:row.tier,period:row.period,product:`GTO ${GTO_TIER_LABEL[row.tier]}`,replaces:old}});
   const status=statusFromKomoju(sub.status);
   await update(row.id,{komoju_subscription_id:sub.id,komoju_amount:newAmount,price_switch_state:null,status:status==='pending'?'active':status,current_period_end:sub.next_capture_at??row.current_period_end});
   await db().from('gto_price_switches').insert({plan_id:row.id,member_id:row.member_id,old_subscription:old,new_subscription:sub.id,old_amount:row.komoju_amount,new_amount:newAmount,outcome:status==='canceled'?'declined':'ok'});
   if(status==='canceled')failed++;else switched++;
  }catch(e){
   failed++;
   const {data:cur}=await db().from('gto_member_plans').select('price_switch_state').eq('id',row.id).maybeSingle();
   const stage=(cur as {price_switch_state:string|null}|null)?.price_switch_state;
   if(stage==='deleting'){await update(row.id,{price_switch_state:null}).catch(()=>{});} // nothing charged; the next run tries again
   else{
    // The old subscription is gone and the new one may or may not exist: keep access to the paid period and let a person check.
    await update(row.id,{price_switch_state:'failed',status:'canceled',cancel_at_period_end:true,canceled_at:new Date().toISOString()}).catch(()=>{});
    await db().from('gto_price_switches').insert({plan_id:row.id,member_id:row.member_id,old_subscription:old,new_subscription:null,old_amount:row.komoju_amount,new_amount:newAmount,outcome:'check_by_hand'}).then(()=>{},()=>{});
    await sendGtoBillingAlertEmail('GTOプランの料金切り替えで要確認',[`プランID：${row.id}`,'新しい料金での定期課金の作成が完了したか確認できませんでした。KOMOJUの管理画面で、この会員の定期課金が二重になっていないか、作られていないかを確認してください。',`エラー：${e instanceof Error?e.message.slice(0,120):'不明'}`]).catch(()=>{});
   }
  }
 }
 return {switched,failed};
}

/** Cron: the 2027-02-01 / 2027-02-22 price-change notices by email to every プロ member who will be charged.
 * One record per member per notice (gto_plan_notices) — a member is never mailed twice for the same notice. */
export async function sendProPriceNotices(limit=100){
 const due=noticesDue(Date.now());let sent=0;
 for(const n of due){
  const {data,error}=await db().from('gto_member_plans').select('id,member_id,period').eq('tier','pro').in('status',['trialing','active','past_due']).limit(1000);
  if(error)throw new Error('plan_read_failed');
  for(const row of (data??[]) as {id:string;member_id:string;period:BillingPeriod}[]){
   if(sent>=limit)return {sent};
   const {error:claim}=await db().from('gto_plan_notices').insert({member_id:row.member_id,notice_key:n.key});
   if(claim)continue; // already sent (unique) or not writable: skip
   try{
    const {data:u}=await db().auth.admin.getUserById(row.member_id);const to=u?.user?.email;
    if(to&&!to.endsWith('@withdrawn.invalid'))await sendGtoPriceNoticeEmail({to,period:row.period,newPrice:laterPrice('pro',row.period),done:PRO_ROADMAP.filter(i=>i.done).map(i=>i.label),planned:PRO_ROADMAP.filter(i=>!i.done).map(i=>i.label),yenText:yen});
    sent++;
   }catch{await db().from('gto_plan_notices').delete().eq('member_id',row.member_id).eq('notice_key',n.key);} // retry next run
  }
 }
 return {sent};
}

/** Pure state rules for GTO plans (no I/O), shared by the routes, the cron and the tests. */
import {PRO_PRICE_CHANGE_AT,priceAt,type BillingPeriod,type PaidTier} from './plans';
export type PlanStatus='pending'|'trialing'|'active'|'past_due'|'canceled';
export type KomojuSubscriptionStatus='pending'|'active'|'retrying'|'suspended'|'deleted';
/** Our status for a KOMOJU subscription status. A subscription we deleted on purpose keeps access to the paid period. */
export function statusFromKomoju(s:string):PlanStatus{
 switch(s){case 'active':return 'active';case 'retrying':return 'past_due';case 'pending':return 'pending';default:return 'canceled';}
}
/** When a trial ends: create the subscription (first payment is taken at once) unless the member cancelled. */
export function trialDue(row:{status:PlanStatus;trial_ends_at:string|null},now:number):boolean{
 return row.status==='trialing'&&row.trial_ends_at!==null&&Date.parse(row.trial_ends_at)<=now;
}
/** Cancel: during the trial nothing is ever charged; while paying, KOMOJU is stopped and access lasts to the period end. */
export function cancelPlan(row:{status:PlanStatus;current_period_end:string|null},now:number):{status:PlanStatus;cancel_at_period_end:boolean;stopKomoju:boolean}{
 if(row.status==='pending'||row.status==='trialing')return {status:'canceled',cancel_at_period_end:false,stopKomoju:false};
 if(row.status==='active'||row.status==='past_due'){
  const keep=row.current_period_end!==null&&Date.parse(row.current_period_end)>now;
  return {status:'canceled',cancel_at_period_end:keep,stopKomoju:true};
 }
 return {status:'canceled',cancel_at_period_end:false,stopKomoju:false};
}

/** How long before the next KOMOJU charge the cron moves a subscription to the new price (cron runs hourly). */
export const PRICE_SWITCH_LEAD_MS=3*3600000;
export type SwitchRow={tier:PaidTier;period:BillingPeriod;status:PlanStatus;komoju_subscription_id:string|null;komoju_amount:number|null;
 current_period_end:string|null;price_switch_state:string|null};
/** A KOMOJU subscription has a fixed amount. When the next charge falls on/after a price change, we stop the old
 * subscription shortly before that charge and create one at the new price (which charges at once = this renewal).
 * Monthly: the first charge on/after 2027-03-01. Yearly: the next renewal on/after that day (the paid year keeps its price).
 * Only when nothing is in progress for the row, so nobody is charged twice or skipped. */
export function priceSwitchDue(row:SwitchRow,now:number):{due:boolean;newAmount:number}{
 const next=row.current_period_end?Date.parse(row.current_period_end):NaN;
 const newAmount=Number.isFinite(next)?priceAt(row.tier,row.period,next):0;
 const due=row.status==='active'&&Boolean(row.komoju_subscription_id)&&row.price_switch_state===null&&Number.isFinite(next)
  &&next>=PRO_PRICE_CHANGE_AT&&row.komoju_amount!==null&&row.komoju_amount<newAmount&&now>=next-PRICE_SWITCH_LEAD_MS&&now<next;
 return {due,newAmount};
}

/** Price-change notices to プロ members (2027-02-01 and 2027-02-22, JST). */
export const PRO_NOTICES=[{key:'pro-price-notice-1',at:Date.parse('2027-02-01T09:00:00+09:00')},{key:'pro-price-notice-2',at:Date.parse('2027-02-22T09:00:00+09:00')}] as const;
/** Which notices are due at `now` (only before the change day). */
export function noticesDue(now:number){return PRO_NOTICES.filter(n=>now>=n.at&&now<PRO_PRICE_CHANGE_AT);}
/** The player page shows the notice from the first notice day until the change day. */
export const showPriceNotice=(now:number)=>now>=PRO_NOTICES[0].at&&now<PRO_PRICE_CHANGE_AT;

/** Pure state rules for GTO plans (no I/O), shared by the routes, the cron and the tests. */
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

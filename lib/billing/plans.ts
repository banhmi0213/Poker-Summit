/** GTO paid plans (owner + GTO chat, 2026/11/01). All prices live here; change them in one place.
 * フル will go up once the 8–9-handed flop strategies are complete — update FULL here and the legal pages read it. */
export type GtoTier='free'|'light'|'full';
export type PaidTier=Exclude<GtoTier,'free'>;
export type BillingPeriod='month'|'year';
export const GTO_TRIAL_DAYS=3;
export const GTO_PRICES:Record<PaidTier,Record<BillingPeriod,number>>={
 light:{month:980,year:9800},
 full:{month:1980,year:19800},
};
export const GTO_TIER_LABEL:Record<GtoTier,string>={free:'無料',light:'ライト',full:'フル'};
export const PERIOD_LABEL:Record<BillingPeriod,string>={month:'月額',year:'年額'};
/** KOMOJU subscription period names. */
export const KOMOJU_PERIOD:Record<BillingPeriod,'monthly'|'yearly'>={month:'monthly',year:'yearly'};
export const yen=(n:number)=>`${n.toLocaleString('ja-JP')}円`;
export function isPaidTier(v:unknown):v is PaidTier{return v==='light'||v==='full';}
export function isPeriod(v:unknown):v is BillingPeriod{return v==='month'||v==='year';}
/** Billing stays dormant until the owner turns it on (NEXT_PUBLIC_GTO_BILLING=on) and the KOMOJU keys exist. */
export const GTO_BILLING_FLAG=process.env.NEXT_PUBLIC_GTO_BILLING==='on';

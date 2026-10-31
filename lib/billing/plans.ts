/** GTO paid plans (owner + GTO chat, final decision 2026/11/01): スタンダード and プロ. All prices live here.
 * スタンダード is a fixed price (never call it スタート記念価格). プロ is sold at an スタート記念価格 until the end of February 2027
 * and moves to the regular price from 2027-03-01 (JST) — also for existing members: monthly plans from the first charge
 * on/after that day, yearly plans at their next renewal (the paid year keeps its price). */
export type GtoTier='free'|'standard'|'pro';
export type PaidTier=Exclude<GtoTier,'free'>;
export type BillingPeriod='month'|'year';
export const GTO_TRIAL_DAYS=3;
type PriceStep={from:number;month:number;year:number};
const JST=(d:string)=>Date.parse(`${d}T00:00:00+09:00`);
/** The day プロ moves from the スタート記念価格 to the regular price (JST midnight). */
export const PRO_PRICE_CHANGE_AT=JST('2027-03-01');
/** Price by date, oldest first: the step whose `from` is the latest one not after the date applies. */
export const GTO_PRICE_SCHEDULE:Record<PaidTier,readonly PriceStep[]>={
 standard:[{from:0,month:980,year:9800}],
 pro:[{from:0,month:1980,year:19800},{from:PRO_PRICE_CHANGE_AT,month:2980,year:29800}],
};
/** The price that applies to a charge made at `at` (ms). */
export function priceAt(tier:PaidTier,period:BillingPeriod,at:number):number{
 let price=GTO_PRICE_SCHEDULE[tier][0][period];
 for(const step of GTO_PRICE_SCHEDULE[tier])if(at>=step.from)price=step[period];
 return price;
}
/** The price after the scheduled change (for notices and the pricing page). */
export function laterPrice(tier:PaidTier,period:BillingPeriod){const s=GTO_PRICE_SCHEDULE[tier];return s[s.length-1][period];}
/** Prices on sale right now (pricing page, panel). */
export function currentPrices(now=Date.now()):Record<PaidTier,Record<BillingPeriod,number>>{
 return {standard:{month:priceAt('standard','month',now),year:priceAt('standard','year',now)},pro:{month:priceAt('pro','month',now),year:priceAt('pro','year',now)}};
}
/** Today's prices; kept for older imports. */
export const GTO_PRICES=currentPrices();
export const proIsOpenPrice=(now=Date.now())=>now<PRO_PRICE_CHANGE_AT;
export const GTO_TIER_LABEL:Record<GtoTier,string>={free:'無料',standard:'スタンダード',pro:'プロ'};
export const PERIOD_LABEL:Record<BillingPeriod,string>={month:'月額',year:'年額'};
/** KOMOJU subscription period names. */
export const KOMOJU_PERIOD:Record<BillingPeriod,'monthly'|'yearly'>={month:'monthly',year:'yearly'};
export const yen=(n:number)=>`${n.toLocaleString('ja-JP')}円`;
/** Older names (ライト／フル) are still accepted as input and mapped. */
export function normalizeTier(v:unknown):PaidTier|null{
 if(v==='standard'||v==='light')return 'standard';
 if(v==='pro'||v==='full')return 'pro';
 return null;
}
export function isPaidTier(v:unknown):v is PaidTier{return v==='standard'||v==='pro';}
export function isPeriod(v:unknown):v is BillingPeriod{return v==='month'||v==='year';}

/** プロのスタート記念価格の説明 (GTO chat 2026/11/01, exact wording). Shown on /pricing and in the sign-up step. */
export const PRO_PRICE_VERSION='pro-open-202703';
export const PRO_PRICE_LINES:Record<BillingPeriod,{head:string;change:string}>={
 month:{head:'プロ　月1,980円（スタート記念価格）',change:'2027年2月末までのスタート記念価格です。2027年3月1日から月2,980円になります（今入った方も、この日から新しい料金です）。'},
 year:{head:'プロ　年19,800円（スタート記念価格）',change:'2027年2月末までのスタート記念価格です。2027年3月1日以降の更新から年29,800円になります（今入った方も、次の更新から新しい料金です。お支払い済みの1年間はそのままです）。'},
};
export const PRO_CONSENT_LABEL='値上げの日と新しい料金を確認しました';
/** Billing stays dormant until the owner turns it on (NEXT_PUBLIC_GTO_BILLING=on) and the KOMOJU keys exist. */
export const GTO_BILLING_FLAG=process.env.NEXT_PUBLIC_GTO_BILLING==='on';

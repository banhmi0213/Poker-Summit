/** Ring ranks (owner 2026/11/01): lifetime BB at ring tables (after rake). Thresholds live in the database (poker_private.ring_tier). */
export const RING_TIERS=['ルーキー','ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド','レジェンド'] as const;
export const RING_TIER_EN=['ROOKIE','BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','LEGEND'] as const;
export type RingTierLimits={min:number;max:number};
export type RingRank={tier:number;bb:number;hands:number;place:number|null;players:number;next:number|null;floor:number|null;rookieHandsLeft:number;baseChips:number};
export const tierName=(tier:number)=>RING_TIERS[Math.max(0,Math.min(6,Math.trunc(tier)))];
export const tierAllowed=(tier:number|null,limits:RingTierLimits|undefined)=>!limits||tier===null||(tier>=limits.min&&tier<=limits.max);
/** The short label for a table's condition, or null when anyone can sit. */
export function tierCondition(limits:RingTierLimits|undefined):string|null{
 if(!limits||(limits.min<=0&&limits.max>=6))return null;
 if(limits.min>0&&limits.max>=6)return `${tierName(limits.min)}以上`;
 if(limits.min<=0)return `${tierName(limits.max)}まで`;
 return `${tierName(limits.min)}〜${tierName(limits.max)}`;
}
export function parseRingRank(v:unknown):RingRank|null{
 if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>,n=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:Number(x);
 const tier=n(r.tier);if(!Number.isInteger(tier)||tier<0||tier>6)return null;
 const opt=(x:unknown)=>x===null||x===undefined?null:n(x);
 return {tier,bb:n(r.bb)||0,hands:n(r.hands)||0,place:opt(r.place),players:n(r.players)||0,next:opt(r.next),floor:opt(r.floor),rookieHandsLeft:n(r.rookieHandsLeft)||0,baseChips:n(r.baseChips)||1000};
}

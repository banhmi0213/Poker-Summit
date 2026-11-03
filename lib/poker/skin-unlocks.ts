/** Skin unlocks (owner 2026/10/31): a one-time free pick of a table, a card face and a card back, then one free pick per
 * ring-hand milestone: cards (face or back) at 100 / 300 / 600 / 1,000 / 1,500 hands, tables at 2,000 / 3,000 / 5,000. Owner 2026/11/03: no chip exchange for skins
 * (chips reset monthly). Paid skins are not built yet. */
export type SkinPicks={milestones:number[];earned:number;used:number};
export type SkinStatus={starterDone:boolean;hands:number;milestones:number[];picksEarned:number;picksUsed:number;owned:string[];card?:SkinPicks;table?:SkinPicks};
export function parseSkinStatus(v:unknown):SkinStatus{
 const s=v as SkinStatus;
 if(!s||typeof s.starterDone!=='boolean'||!Number.isSafeInteger(s.hands)||s.hands<0||!Array.isArray(s.milestones)||!s.milestones.every(m=>Number.isSafeInteger(m)&&m>0)
  ||!Number.isSafeInteger(s.picksEarned)||!Number.isSafeInteger(s.picksUsed)||s.picksUsed<0||!Array.isArray(s.owned)||!s.owned.every(o=>typeof o==='string'))throw Error('Invalid skin status');
 const r=s as unknown as Record<string,unknown>,ints=(v:unknown)=>Array.isArray(v)&&v.every(m=>Number.isSafeInteger(m)&&(m as number)>0)?[...v as number[]]:null;
 const picks=(m:unknown,e:unknown,u:unknown):SkinPicks|undefined=>{const list=ints(m);return list&&Number.isSafeInteger(e)&&Number.isSafeInteger(u)?{milestones:list,earned:e as number,used:u as number}:undefined;};
 return {starterDone:s.starterDone,hands:s.hands,milestones:[...s.milestones],picksEarned:s.picksEarned,picksUsed:s.picksUsed,owned:[...s.owned],
  card:picks(r.cardMilestones,r.cardPicksEarned,r.cardPicksUsed),table:picks(r.tableMilestones,r.tablePicksEarned,r.tablePicksUsed)};
}
/** Free picks left right now. */
export const picksLeft=(s:SkinStatus)=>Math.max(0,s.picksEarned-s.picksUsed);
/** Free picks left for one kind (owner 2026/11/03: cards and tables have their own milestones). */
export const kindPicksLeft=(s:SkinStatus,kind:'card'|'table')=>{const k=s[kind];return k?Math.max(0,k.earned-k.used):picksLeft(s);};
/** Hands to the next pick of one kind, or null after its last milestone. */
export function kindHandsToNext(s:SkinStatus,kind:'card'|'table'):number|null{const list=s[kind]?.milestones??s.milestones;const next=list.find(m=>m>s.hands);return next===undefined?null:next-s.hands;}
/** Hands still needed for the next free pick, or null after the last milestone. */
export function handsToNextPick(s:SkinStatus):number|null{const next=s.milestones.find(m=>m>s.hands);return next===undefined?null:next-s.hands;}
export function skinUnlockError(message?:string){
 if(!message)return '通信できませんでした。もう一度お試しください。';
 if(/Starter already chosen/.test(message))return 'はじめのデザインはすでに選んでいます。';
 if(/No picks left/.test(message))return '無料で選べる特典が残っていません。';
 if(/Already owned/.test(message))return 'このデザインはすでに持っています。';
 if(/Invalid skin/.test(message))return '選べないデザインです。選び直してください。';
 if(/Login required/.test(message))return 'ログインしてください。';
 return '受け付けられませんでした。もう一度お試しください。';
}

/** Skin unlocks (owner 2026/10/31): a one-time free pick of a table, a card face and a card back, then chips at the
 * exchange or one free pick per ring-hand milestone (100 / 500 / 1,500 / 3,000 hands). Paid skins are not built yet. */
export type SkinStatus={starterDone:boolean;hands:number;milestones:number[];picksEarned:number;picksUsed:number;owned:string[]};
export function parseSkinStatus(v:unknown):SkinStatus{
 const s=v as SkinStatus;
 if(!s||typeof s.starterDone!=='boolean'||!Number.isSafeInteger(s.hands)||s.hands<0||!Array.isArray(s.milestones)||!s.milestones.every(m=>Number.isSafeInteger(m)&&m>0)
  ||!Number.isSafeInteger(s.picksEarned)||!Number.isSafeInteger(s.picksUsed)||s.picksUsed<0||!Array.isArray(s.owned)||!s.owned.every(o=>typeof o==='string'))throw Error('Invalid skin status');
 return {starterDone:s.starterDone,hands:s.hands,milestones:[...s.milestones],picksEarned:s.picksEarned,picksUsed:s.picksUsed,owned:[...s.owned]};
}
/** Free picks left right now. */
export const picksLeft=(s:SkinStatus)=>Math.max(0,s.picksEarned-s.picksUsed);
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

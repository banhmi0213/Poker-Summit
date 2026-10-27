// Player HUD shared helpers: note validation and stat formatting (ring tables).
export const HUD_COLORS=['red','orange','yellow','green','blue','purple'] as const;
export type HudColor=typeof HUD_COLORS[number];
export const HUD_COLOR_LABELS:Record<HudColor,string>={red:'赤',orange:'オレンジ',yellow:'黄',green:'緑',blue:'青',purple:'紫'};
export const HUD_COLOR_VALUES:Record<HudColor,string>={red:'#f05b58',orange:'#f39a3d',yellow:'#f3c663',green:'#4fbf7a',blue:'#4c8dff',purple:'#a46ef0'};
export type HudStats={hands:number;vpip:number;pfr:number;threeBet:number;threeBetOpp:number;cbet:number;cbetOpp:number;foldTo3Bet:number;foldTo3BetOpp:number;foldToCbet:number;foldToCbetOpp:number;sawFlop:number;wtsd:number;wsd:number};
export type HudPlayer={seat:number;you:boolean;stats:HudStats;note:string|null;color:HudColor|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isHudColor(value:unknown):value is HudColor{return typeof value==='string'&&(HUD_COLORS as readonly string[]).includes(value);}
export function parseHudNote(value:unknown){
 if(!value||typeof value!=='object')throw Error('invalid');const v=value as Record<string,unknown>;
 if(typeof v.table!=='string'||!uuid.test(v.table))throw Error('invalid');
 if(!Number.isInteger(v.seat)||(v.seat as number)<1||(v.seat as number)>6)throw Error('invalid');
 if(typeof v.note!=='string'||[...v.note.trim()].length>500)throw Error('invalid');
 if(v.color!==null&&!isHudColor(v.color))throw Error('invalid');
 return {table:v.table,seat:v.seat as number,note:v.note.trim(),color:v.color as HudColor|null};
}
// "—" until there is at least one opportunity; whole percent otherwise.
export function hudRate(count:number,opportunities:number){return opportunities>0?`${Math.round(count*100/opportunities)}%`:'—';}
export function hudRows(s:HudStats):[string,string,string][]{
 return [
  ['VPIP',hudRate(s.vpip,s.hands),`${s.vpip}/${s.hands}`],
  ['PFR',hudRate(s.pfr,s.hands),`${s.pfr}/${s.hands}`],
  ['3ベット',hudRate(s.threeBet,s.threeBetOpp),`${s.threeBet}/${s.threeBetOpp}`],
  ['3ベットにフォールド',hudRate(s.foldTo3Bet,s.foldTo3BetOpp),`${s.foldTo3Bet}/${s.foldTo3BetOpp}`],
  ['CB',hudRate(s.cbet,s.cbetOpp),`${s.cbet}/${s.cbetOpp}`],
  ['CBにフォールド',hudRate(s.foldToCbet,s.foldToCbetOpp),`${s.foldToCbet}/${s.foldToCbetOpp}`],
  ['WTSD',hudRate(s.wtsd,s.sawFlop),`${s.wtsd}/${s.sawFlop}`],
  ['W$SD',hudRate(s.wsd,s.wtsd),`${s.wsd}/${s.wtsd}`],
 ];
}

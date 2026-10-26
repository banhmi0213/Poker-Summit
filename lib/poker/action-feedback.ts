import {playTableEffect} from './table-effects';
/** Presentation from public betting totals only; no cards or credentials retained. */
export type ActionKind='fold'|'check'|'call'|'bet'|'raise'|'allin';
export type ActionPlayer={id:string;committed:number;totalCommitted:number;folded:boolean;allIn:boolean};
export const actionWords:Record<ActionKind,string>={fold:'フォールド',check:'チェック',call:'コール',bet:'ベット',raise:'レイズ',allin:'オールイン'};
export function publicAction(before:readonly ActionPlayer[]|undefined,after:readonly ActionPlayer[]|undefined,actor:string|null){
 const a=before?.find(p=>p.id===actor),b=after?.find(p=>p.id===actor);if(!a||!b||a.folded||a.allIn)return null;
 const amount=Math.max(0,b.totalCommitted-a.totalCommitted),priorBet=Math.max(0,...before!.map(p=>p.committed));
 const kind:ActionKind=b.folded?'fold':b.allIn?'allin':amount===0?'check':a.committed+amount>priorBet?(priorBet>0?'raise':'bet'):'call';
 return {kind,amount,actor:actor!,label:actionWords[kind]};
}
/** Chosen table effects (see table-effects.ts). */
export function playActionEffect(c:AudioContext,kind:ActionKind){return playTableEffect(c,kind);}

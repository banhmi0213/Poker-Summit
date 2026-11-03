/** Review of the viewer's own decisions in a finished hand (2026/10/26).
 * Works only from what the viewer is allowed to see: their own hole cards and the public actions/board.
 */
import type {Card} from './engine';
import type {HistoryAction} from './hand-history';
import {estimateEquity,judgeDecision,requiredEquity,type DecisionNote} from './equity';

type ReviewHand={board:Card[];actions:HistoryAction[];players:{seatId:string;startStack:number;you:boolean;hole:Card[]|null}[]};
export type DecisionReview={index:number;street:HistoryAction['street'];action:HistoryAction['type'];toCall:number;pot:number;opponents:number;required:number;equity:number;note:DecisionNote};
const boardCount={preflop:0,flop:3,turn:4,river:5} as const;
const forced=new Set(['ante','sb','bb']);

export function reviewDecisions(hand:ReviewHand,options:{iterations?:number;random?:()=>number}={}):DecisionReview[]{
 const me=hand.players.find(p=>p.you);
 if(!me?.hole||me.hole.length!==2)return [];
 const out:DecisionReview[]=[];
 hand.actions.forEach((a,i)=>{
  if(a.seatId!==me.seatId||forced.has(a.type))return;
  const before=hand.actions.slice(0,i);
  const board=hand.board.slice(0,boardCount[a.street]);
  if(board.length!==boardCount[a.street])return; // board not recorded that far; skip rather than guess
  // Street commitments just before this action: each seat's latest "to" on this street.
  const street=new Map<string,number>();
  for(const b of before)if(b.street===a.street&&b.type!=='ante')street.set(b.seatId,b.to);
  const currentBet=Math.max(0,...street.values());
  const paid=before.filter(b=>b.seatId===me.seatId).reduce((s,b)=>s+b.amount,0);
  const toCall=Math.max(0,Math.min(currentBet-(street.get(me.seatId)??0),me.startStack-paid));
  const pot=i>0?before[before.length-1].pot:0;
  const folded=new Set(before.filter(b=>b.type==='fold').map(b=>b.seatId));
  const opponents=hand.players.filter(p=>p.seatId!==me.seatId&&!folded.has(p.seatId)).length;
  if(opponents<1)return;
  const equity=estimateEquity(me.hole!,board,Math.min(opponents,8),options.iterations??1200,options.random).equity;
  const required=requiredEquity(toCall,pot);
  out.push({index:i,street:a.street,action:a.type,toCall,pot,opponents,required,equity,note:judgeDecision(a.type as 'fold',equity,required)});
 });
 return out;
}

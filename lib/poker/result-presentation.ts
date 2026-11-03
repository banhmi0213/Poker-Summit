/** Display-only timeline. Authoritative payouts are never applied by this module. */
import {RUNOUT_STEP_MS,PAYOUT_ANIMATION_MS} from './presentation-timing';
import type {PlayerSnapshot} from './player-client';
export function resultPresentation(source:PlayerSnapshot,now=source.serverNow){
 const hand=source.hand,result=hand?.result,completed=source.completedAt;
 const elapsed=completed===null?Infinity:Math.max(0,now-completed);
 const runout=result?.showdown&&source.runout?.handId===hand?.handId?source.runout:null;
 const counts=runout?[runout.fromBoardCount,...[3,4,5].filter(n=>n>runout.fromBoardCount)]:[];
 const revealMs=runout?counts.length*RUNOUT_STEP_MS:0;
 if(runout&&elapsed<revealMs&&hand&&result){
  const state=structuredClone(source),h=state.hand!;
  const count=counts[Math.min(counts.length-1,Math.floor(elapsed/RUNOUT_STEP_MS))];
  h.board=h.board.slice(0,count);h.street=count===0?'preflop':count===3?'flop':count===4?'turn':'river';
  h.pot=Object.values(result.payouts).reduce((a,b)=>a+b,0);
  h.players=h.players.map(p=>({...p,stack:p.stack-(result.payouts[p.id]??0),committed:0}));
  h.result=null;h.legal=null;h.toAct=null;state.tournament=null;state.phase='complete';
  return {state,collecting:false,revealing:true,remainingMs:revealMs-elapsed};
 }
 return {state:source,collecting:Boolean(result&&elapsed>=revealMs&&elapsed<revealMs+PAYOUT_ANIMATION_MS),revealing:false,remainingMs:Math.max(0,revealMs+PAYOUT_ANIMATION_MS-elapsed)};
}

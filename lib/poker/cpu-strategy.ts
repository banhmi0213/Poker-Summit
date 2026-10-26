/** Practice-table CPU players (2026/10/26). Each bot decides from ITS OWN cards and the public table only.
 * Preflop: hand rank (equity vs a random hand) against position/situation thresholds, scaled by the bot's style.
 * Postflop: Monte Carlo equity vs the remaining players, discounted when facing aggression, against pot odds.
 * This is a sparring partner, not a GTO solution; styles make the table feel like different opponents.
 */
import rank from '@/data/poker-gto/preflop-rank.json';
import type {Card} from './engine';
import type {BettingAction} from './betting';
import {estimateEquity,requiredEquity} from './equity';

export type CpuStyle={name:string;looseness:number;aggression:number;bluff:number};
export const CPU_STYLES:Record<string,CpuStyle>={
 standard:{name:'標準',looseness:1,aggression:1,bluff:0.08},
 tight:{name:'堅実',looseness:0.75,aggression:0.8,bluff:0.04},
 loose:{name:'参加多め',looseness:1.45,aggression:0.7,bluff:0.06},
 aggressive:{name:'攻撃的',looseness:1.15,aggression:1.4,bluff:0.16},
};
export type CpuContext={hole:readonly Card[];board:readonly Card[];pot:number;toCall:number;stack:number;committed:number;currentBet:number;bigBlind:number;
 legal:{check:boolean;call:boolean;raise:boolean;minRaiseTo:number|null;maxRaiseTo:number|null};opponents:number;playersBehind:number;isBigBlind:boolean};

const order:string[]=rank.order;
const R='23456789TJQKA';
export function classLabel(h:readonly Card[]){const [a,b]=[...h].sort((x,y)=>y.rank-x.rank);const ra=R[a.rank-2],rb=R[b.rank-2];return a.rank===b.rank?ra+rb:ra+rb+(a.suit===b.suit?'s':'o');}
/** 0 = best starting hand, 1 = worst (by combo share, so "top 15%" means 15% of all deals). */
export function handPercentile(h:readonly Card[]){
 const label=classLabel(h);let before=0,total=0;const combos=(l:string)=>l.length===2?6:l.endsWith('s')?4:12;
 for(const l of order){if(l===label)before=total;total+=combos(l);}
 return (before+combos(label)/2)/total;
}
const clampTo=(v:number,ctx:CpuContext)=>Math.max(ctx.legal.minRaiseTo??v,Math.min(ctx.legal.maxRaiseTo??v,Math.round(v)));
const passive=(ctx:CpuContext):BettingAction=>ctx.legal.check?{type:'check'}:{type:'fold'};

function preflop(ctx:CpuContext,s:CpuStyle,random:()=>number):BettingAction{
 const p=handPercentile(ctx.hole),bb=ctx.bigBlind,mix=(random()-0.5)*0.03;
 const raiseTo=(x:number)=>ctx.legal.raise?{type:'raise' as const,amount:clampTo(x,ctx)}:ctx.legal.call?{type:'call' as const}:passive(ctx);
 if(ctx.currentBet<=bb){
  // Unopened (or limped): fewer players behind -> wider opens.
  const open=([0,0.42,0.42,0.27,0.2,0.16,0.14][Math.min(ctx.playersBehind,6)])*s.looseness;
  if(p<open+mix)return raiseTo((ctx.playersBehind<=1?3:2.5)*bb);
  if(ctx.legal.check)return {type:'check'};
  return p<open*1.3*s.looseness&&ctx.toCall<=bb/2?{type:'call'}:{type:'fold'};
 }
 const raises=ctx.currentBet<=4*bb?1:2;
 if(raises===1){
  const three=0.05*s.aggression;
  if(p<three+mix)return raiseTo(ctx.currentBet*(ctx.playersBehind>0?3:3.5));
  // Call when the hand's equity vs a random hand, discounted because the raiser's range is stronger
  // (more so with players still behind), beats the pot odds. Loose styles discount less.
  const eqRandom=(rank.equity as Record<string,number>)[classLabel(ctx.hole)]/100;
  const discount=(0.12+0.03*ctx.playersBehind)/s.looseness;
  if(eqRandom-discount>requiredEquity(ctx.toCall,ctx.pot)&&ctx.toCall<=ctx.stack)return {type:'call'};
  return {type:'fold'};
 }
 if(p<0.025*s.aggression+0.01)return ctx.legal.raise?{type:'raise',amount:clampTo(ctx.legal.maxRaiseTo??ctx.currentBet*2.5,ctx)}:{type:'call'};
 if(p<0.06*s.looseness&&ctx.toCall<=ctx.stack*0.4)return {type:'call'};
 return {type:'fold'};
}

function postflop(ctx:CpuContext,s:CpuStyle,random:()=>number):BettingAction{
 const raw=estimateEquity(ctx.hole,ctx.board,Math.max(1,Math.min(ctx.opponents,8)),350,random).equity;
 // Facing a bet, the bettor's range is stronger than random: discount by how big the bet is.
 const pressure=ctx.toCall>0?Math.min(0.32,0.12+0.2*ctx.toCall/Math.max(ctx.pot,1)+0.04*(ctx.opponents-1)):0;
 const eq=raw-pressure;
 const sized=(f:number)=>({type:ctx.currentBet>0?'raise' as const:'bet' as const,amount:clampTo((ctx.currentBet>0?ctx.currentBet:0)+f*ctx.pot,ctx)});
 const river=ctx.board.length===5;
 if(ctx.toCall===0){
  if(ctx.legal.raise&&eq>0.62/s.aggression*0.95)return sized(eq>0.8?0.75:0.55);
  if(ctx.legal.raise&&!river&&eq<0.35&&random()<s.bluff)return sized(0.5);
  return {type:'check'};
 }
 const need=requiredEquity(ctx.toCall,ctx.pot);
 if(ctx.legal.raise&&eq>0.78&&random()<0.6*s.aggression)return {type:'raise',amount:clampTo(ctx.currentBet*2.8,ctx)};
 if(eq>need+0.05/s.looseness)return {type:'call'};
 return {type:'fold'};
}

export function decideCpuAction(ctx:CpuContext,style:CpuStyle=CPU_STYLES.standard,random:()=>number=Math.random):BettingAction{
 if(ctx.hole.length!==2)return passive(ctx);
 const a=ctx.board.length===0?preflop(ctx,style,random):postflop(ctx,style,random);
 // Never fold when checking is free; never bet/raise outside the legal window.
 if(a.type==='fold'&&ctx.legal.check)return {type:'check'};
 if((a.type==='raise'||a.type==='bet')&&!ctx.legal.raise)return ctx.legal.call?{type:'call'}:passive(ctx);
 if(a.type==='call'&&!ctx.legal.call)return passive(ctx);
 return a;
}

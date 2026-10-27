/** Staging-only CPU hands (owner request 2026/10/27): bots play real server hands nonstop to collect hand data
 * and to catch engine bugs. Every hand goes through the same AuthoritativeHand the live tables use, then is
 * checked (chip conservation, legal flow, replay from checkpoint, history build). Nothing here touches money.
 */
import {randomInt} from 'node:crypto';
import {AuthoritativeHand,type HandCheckpoint} from './authoritative-hand';
import {buildHandHistory,type HandHistory} from './hand-history';
import {decideCpuAction,CPU_STYLES} from './cpu-strategy';
import type {HandTerms} from './tournament-hand';
import type {BettingAction} from './betting';

export type BotAnomaly={kind:string;detail:string;checkpoint:HandCheckpoint|null};
export type BotHand={history:HandHistory|null;actions:number;ms:number;anomalies:BotAnomaly[];stacks:Record<string,number>};
const STYLE_ORDER=['standard','tight','loose','aggressive','standard','aggressive'] as const;
const MAX_ACTIONS=400;

/** Plays one complete hand with CPU players. Never throws: problems come back as anomalies. */
export function playBotHand(seats:readonly string[],stacks:Readonly<Record<string,number>>,buttonIndex:number,terms:HandTerms,random:()=>number=()=>randomInt(1_000_000)/1_000_000):BotHand{
 const started=performance.now(),anomalies:BotAnomaly[]=[];
 const live=seats.filter(id=>(stacks[id]??0)>0),entries=live.map(id=>({id,stack:stacks[id]}));
 const before=entries.reduce((s,p)=>s+p.stack,0);
 let hand:AuthoritativeHand,actions=0;
 const fail=(kind:string,error:unknown)=>{anomalies.push({kind,detail:error instanceof Error?error.message:String(error),checkpoint:safeCheckpoint()});};
 const safeCheckpoint=()=>{try{return hand.checkpoint();}catch{return null;}};
 try{hand=new AuthoritativeHand(entries,Math.max(0,live.indexOf(seats[buttonIndex%seats.length])),terms,undefined,undefined,{runItTwice:true});}
 catch(error){return {history:null,actions:0,ms:performance.now()-started,anomalies:[{kind:'start_failed',detail:error instanceof Error?error.message:String(error),checkpoint:null}],stacks:{...stacks}};}
 const styleOf=(id:string)=>CPU_STYLES[STYLE_ORDER[Math.max(0,seats.indexOf(id))%STYLE_ORDER.length]];
 while(actions<MAX_ACTIONS){
  const pub=hand.snapshot(null);
  if(pub.result)break;
  // All-in runout: each player answers run it once/twice at random (both answers must be exercised).
  if(pub.runs&&pub.runs.decided===null){
   const id=pub.runs.participants.find(p=>pub.runs!.choices[p]===null);
   if(!id){fail('runs_stuck','no participant left to answer');break;}
   try{hand.act(id,{handId:pub.handId,revision:pub.revision,actionId:'b'+actions,action:{type:'runs',count:random()<0.5?1:2}});actions++;}catch(error){fail('runs_rejected',error);break;}
   continue;
  }
  const actor=pub.toAct;
  if(!actor){fail('no_actor','hand has no result and nobody to act');break;}
  const view=hand.snapshot(actor),me=view.players.find(p=>p.id===actor)!,legal=view.legal;
  if(!legal||!me.hole){fail('no_legal','actor has no legal actions or no cards');break;}
  const others=view.players.filter(p=>p.id!==actor&&!p.folded),currentBet=Math.max(...view.players.map(p=>p.committed));
  let decision:BettingAction;
  try{decision=decideCpuAction({hole:me.hole,board:view.board,pot:view.pot,toCall:legal.callAmount,stack:me.stack,committed:me.committed,currentBet,bigBlind:terms.bb,legal,
   opponents:others.length,playersBehind:others.filter(p=>!p.allIn).length,isBigBlind:view.positions.bb===actor,
   maxOpponentStack:Math.max(0,...others.map(p=>p.stack+p.committed))},styleOf(actor),random);}
  catch(error){fail('strategy_failed',error);decision=legal.check?{type:'check'}:{type:'fold'};}
  try{hand.act(actor,{handId:pub.handId,revision:pub.revision,actionId:'b'+actions,action:decision});actions++;}
  catch(error){
   // A bot choosing an illegal wager is a strategy bug, not an engine bug; record it and fall back.
   fail('action_rejected',`${JSON.stringify(decision)}: ${error instanceof Error?error.message:String(error)}`);
   try{hand.act(actor,{handId:pub.handId,revision:pub.revision,actionId:'f'+actions,action:legal.check?{type:'check'}:{type:'fold'}});actions++;}catch(e2){fail('fallback_rejected',e2);break;}
  }
 }
 const end=hand.snapshot(null);
 if(!end.result){if(actions>=MAX_ACTIONS)fail('too_many_actions',String(actions));return {history:null,actions,ms:performance.now()-started,anomalies,stacks:{...stacks}};}
 const after:Record<string,number>={...stacks};for(const p of end.players)after[p.id]=p.stack;
 const total=end.players.reduce((s,p)=>s+p.stack,0);
 if(total!==before)fail('chips_not_conserved',`before ${before} after ${total}`);
 if(end.players.some(p=>!Number.isSafeInteger(p.stack)||p.stack<0))fail('bad_stack',JSON.stringify(end.players.map(p=>p.stack)));
 const paid=Object.values(end.result.payouts).reduce((s,v)=>s+v,0),committed=end.players.reduce((s,p)=>s+p.totalCommitted,0);
 if(paid!==committed)fail('payout_mismatch',`paid ${paid} committed ${committed}`);
 if(!end.result.winners.length)fail('no_winner','');
 const checkpoint=hand.checkpoint();
 try{const replayed=AuthoritativeHand.restore(checkpoint).snapshot(null);if(JSON.stringify(replayed.result)!==JSON.stringify(end.result))fail('replay_mismatch','restored result differs');}catch(error){fail('replay_failed',error);}
 let history:HandHistory|null=null;
 try{history=buildHandHistory(checkpoint,Object.fromEntries(live.map(id=>[id,'bot-'+id.slice(5)])));
  const net=history.players.reduce((s,p)=>s+p.net,0);if(net!==0)fail('history_net_nonzero',String(net));}
 catch(error){fail('history_failed',error);}
 return {history,actions,ms:performance.now()-started,anomalies,stacks:after};
}

/** A table of 6 bots that keeps going: the button moves, a player who goes bust buys back in for 100BB. */
export class BotTable{
 readonly seats:string[];#stacks:Record<string,number>;#button=0;#terms:HandTerms;hands=0;
 constructor(readonly table:number,terms:HandTerms,size=6){
  this.#terms={...terms};this.seats=Array.from({length:size},(_,i)=>`seat-${i+1}`);
  this.#stacks=Object.fromEntries(this.seats.map(id=>[id,terms.bb*100]));
 }
 play(random?:()=>number){
  for(const id of this.seats)if(this.#stacks[id]<=0)this.#stacks[id]=this.#terms.bb*100;
  const result=playBotHand(this.seats,this.#stacks,this.#button,this.#terms,random);
  this.#stacks=result.stacks;this.#button=(this.#button+1)%this.seats.length;this.hands++;
  return result;
 }
}

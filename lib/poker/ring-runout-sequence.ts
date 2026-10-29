/** Browser-local presentation only. The server has already committed the result.
 * Use a shared server timeline, while retaining every missing street after stalls. */
import type {RingPlayView} from './ring-play-state';
import {RUNOUT_STEP_MS,PAYOUT_ANIMATION_MS} from './presentation-timing';
// Allow a normal one-second poll to arrive before the shared reveal starts.
export const RING_REVEAL_BUFFER_MS=1200;
export class RingRunoutSequence {
 #view:RingPlayView;#final:RingPlayView|null=null;#queued:RingPlayView|null=null;#until:number|null=null;#done:string|null=null;#anchor:number|null=null;#stages:number[]=[];
 constructor(initial:RingPlayView,now:number){this.#view=initial;this.push(initial,now);}
 get view(){return this.#view;}
 delay(now:number){return this.#until===null?null:Math.max(0,this.#until-now);}
 push(incoming:RingPlayView,now:number){
  if(this.#final){if(incoming.hand.handId!==this.#view.hand.handId)this.#queued=incoming;return this.#view;}
  if(incoming.hand.handId===this.#done){return this.#view;}
  if(this.#until!==null&&incoming.hand.handId!==this.#view.hand.handId){this.#queued=incoming;return this.#view;}
  const runout=incoming.runout;
  if(runout){
   // A completed result on first mount is history, not a new reveal. Connected
   // players who last saw betting must still see every missing street.
   const same=this.#view.hand.handId===incoming.hand.handId;
   if(incoming===this.#view&&incoming.hand.result){this.#done=incoming.hand.handId;return this.#view;}
   const from=incoming===this.#view?runout.from:same?this.#view.hand.board.length:runout.from;
   this.#final={...incoming,deadline:null,hand:structuredClone(runout.final)};
   this.#stages=[runout.from,...[3,4,5].filter(n=>n>runout.from)];
   this.#anchor=runout.startedAt===undefined?null:now+runout.startedAt-incoming.serverNow+RING_REVEAL_BUFFER_MS;
   this.#view=this.mask(from);
   const index=this.#stages.indexOf(from),target=this.#anchor===null||index<0?null:this.#anchor+(index+1)*RUNOUT_STEP_MS;
   // A late join/stalled connection replays every missing street locally.
   if(target!==null&&target>now)this.#until=target;
   else {this.#anchor=null;this.#until=now+RUNOUT_STEP_MS;}
  }else this.#view=incoming;
  return this.#view;
 }
 private mask(count:number):RingPlayView{
  const final=this.#final!,s=structuredClone(final.hand),payouts=s.result!.payouts;
  s.board=s.board.slice(0,count);s.street=count===0?'preflop':count===3?'flop':count===4?'turn':'river';
  s.players=s.players.map(p=>({...p,stack:p.stack-(payouts[p.id]??0)}));s.pot=Object.values(payouts).reduce((a,b)=>a+b,0);
  // Run it twice: both boards are dealt street by street together.
  if(s.result!.boards)s.runBoards=s.result!.boards.map(b=>b.slice(0,count));
  s.result=null;s.legal=null;s.toAct=null;
  return {...final,hand:s};
 }
 tick(now:number){
  if(this.#until===null||now<this.#until)return this.#view;
  if(this.#final){const count=this.#view.hand.board.length,next=[3,4,5].find(n=>n>count);
   if(next!==undefined){this.#view=this.mask(next);
    const target=this.#anchor===null?null:this.#anchor+(this.#stages.indexOf(next)+1)*RUNOUT_STEP_MS;
    // Never compress a street to catch up after a suspended browser/timer.
    this.#until=Math.max(now+RUNOUT_STEP_MS,target??0);}
   else {this.#view=this.#final;this.#done=this.#view.hand.handId;this.#final=null;this.#until=now+PAYOUT_ANIMATION_MS;}
  }else {this.#until=null;const queued=this.#queued;this.#queued=null;if(queued)this.push(queued,now);}
  return this.#view;
 }
}

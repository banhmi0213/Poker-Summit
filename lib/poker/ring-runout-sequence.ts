/** Browser-local presentation only. The server has already committed the result.
 * Advance once per rendered hold, never by elapsed server time or poll count. */
import type {RingPlayView} from './ring-play-state';
import {RUNOUT_STEP_MS,PAYOUT_ANIMATION_MS} from './presentation-timing';
export class RingRunoutSequence {
 #view:RingPlayView;#final:RingPlayView|null=null;#queued:RingPlayView|null=null;#until:number|null=null;#done:string|null=null;
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
   this.#view=this.mask(from);this.#until=now+RUNOUT_STEP_MS;
  }else this.#view=incoming;
  return this.#view;
 }
 private mask(count:number):RingPlayView{
  const final=this.#final!,s=structuredClone(final.hand),payouts=s.result!.payouts;
  s.board=s.board.slice(0,count);s.street=count===0?'preflop':count===3?'flop':count===4?'turn':'river';
  s.players=s.players.map(p=>({...p,stack:p.stack-(payouts[p.id]??0)}));s.pot=Object.values(payouts).reduce((a,b)=>a+b,0);s.result=null;s.legal=null;s.toAct=null;
  return {...final,hand:s};
 }
 tick(now:number){
  if(this.#until===null||now<this.#until)return this.#view;
  if(this.#final){const count=this.#view.hand.board.length,next=[3,4,5].find(n=>n>count);
   if(next!==undefined){this.#view=this.mask(next);this.#until=now+RUNOUT_STEP_MS;}
   else {this.#view=this.#final;this.#done=this.#view.hand.handId;this.#final=null;this.#until=now+PAYOUT_ANIMATION_MS;}
  }else {this.#until=null;const queued=this.#queued;this.#queued=null;if(queued)this.push(queued,now);}
  return this.#view;
 }
}

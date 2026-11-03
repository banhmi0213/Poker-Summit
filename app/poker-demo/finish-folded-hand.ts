import {applyBettingAction, beginNextBettingStreet, legalBettingActions, potTotal, type BettingRound} from '@/lib/poker/betting';
import {CPU_STYLES, decideCpuAction} from '@/lib/poker/cpu-strategy';
import {settleCompletedHand} from '@/lib/poker/hand-settlement';
import type {DemoDeal} from '@/lib/poker/card-display';
import type {LoggedAction, Street} from '@/lib/poker/gto-bot';

/** Practice only: finish unobserved CPU action without presentation timers or worker waits.
 * Use the same equity CPUs as the table's existing fallback, then real side-pot
 * settlement. Never refund the hero's fold, invent payouts, or alter ring play.
 */
export function finishFoldedPracticeHand(initial:BettingRound, deal:DemoDeal, order:readonly string[], button:string, bbSeat:string, street:number, calling=false, random:()=>number=Math.random) {
  if (!initial.players.find(p=>p.id==='you')?.folded) throw new Error('Hero must have folded');
  let round=initial, step=street;
  const log:LoggedAction[]=[];
  const styles:Record<string,string>={p2:'standard',p3:'tight',p4:'loose',p5:'aggressive',p6:'standard'};
  for(let n=0;n<1000;n++) {
    const id=round.toAct;
    if(id) {
      if(id==='you') throw new Error('Folded hero cannot act');
      const p=round.players.find(p=>p.id===id)!, legal=legalBettingActions(round,id)!;
      const opponents=round.players.filter(p=>p.id!==id&&!p.folded);
      const action=calling?legal.check?{type:'check' as const}:{type:'call' as const}:decideCpuAction({
        hole:deal.holes[id],board:deal.board.slice(0,step===0?0:step===1?3:step===2?4:5),
        pot:potTotal(round),toCall:legal.callAmount,stack:p.stack,committed:p.committed,currentBet:round.currentBet,bigBlind:round.bigBlind,legal,
        opponents:opponents.length,playersBehind:opponents.filter(p=>!p.allIn&&!p.acted).length,isBigBlind:id===bbSeat,
        maxOpponentStack:Math.max(0,...opponents.map(p=>p.stack+p.committed)),
      },CPU_STYLES[styles[id]??'standard'],random);
      const next=applyBettingAction(round,id,action), after=next.players.find(p=>p.id===id)!;
      log.push({street:(['preflop','flop','turn','river'] as Street[])[step],id,type:action.type,to:after.committed,allIn:after.allIn,potBefore:potTotal(round),currentBetBefore:round.currentBet,committedBefore:p.committed});
      round=next;
    } else {
      const result=settleCompletedHand(round,deal.board,deal.holes,order,button,step>=3);
      if(result) return {round,payouts:result.payouts,log};
      step++;
      const offset=order.indexOf(button), clockwise=[...order.slice(offset+1),...order.slice(0,offset+1)];
      const first=clockwise.find(id=>round.players.some(p=>p.id===id&&!p.folded&&!p.allIn));
      if(!first) throw new Error('Missing next actor');
      round=beginNextBettingStreet(round,first);
    }
  }
  throw new Error('Practice hand did not finish');
}

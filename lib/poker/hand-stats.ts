/** Per-player tendency flags for one finished hand (2026/10/26).
 * Each "...Opp" flag marks a chance; the paired flag marks what the player did with it.
 * Rates are aggregated later as sum(flag)/sum(opp), so every opportunity is counted once per hand.
 */
import type {HistoryAction} from './hand-history';

export type HandStats={
 vpip:boolean;pfr:boolean;
 threeBetOpp:boolean;threeBet:boolean;
 foldTo3BetOpp:boolean;foldTo3Bet:boolean;
 cbetOpp:boolean;cbet:boolean;
 foldToCbetOpp:boolean;foldToCbet:boolean;
 sawFlop:boolean;wentToShowdown:boolean;wonAtShowdown:boolean;
};
type Input={actions:readonly HistoryAction[];players:readonly {seatId:string;net:number}[];board:readonly unknown[];result:{showdown:boolean;winners:readonly string[]}};
const forced=new Set(['ante','sb','bb']);
const aggressive=(a:HistoryAction)=>a.type==='bet'||a.type==='raise';

export function handStats(h:Input):Record<string,HandStats>{
 const pre=h.actions.filter(a=>a.street==='preflop'&&!forced.has(a.type));
 const flop=h.actions.filter(a=>a.street==='flop');
 const foldedPre=new Set(pre.filter(a=>a.type==='fold').map(a=>a.seatId));
 const reachedFlop=h.board.length>=3;
 const raisesPre=pre.filter(aggressive);
 const opener=raisesPre[0]?.seatId??null,lastAggressor=raisesPre.at(-1)?.seatId??null;
 // The first flop bet, and whether the preflop aggressor made it as a continuation bet.
 const firstFlopBet=flop.findIndex(aggressive);
 const cbetIndex=firstFlopBet>=0&&flop[firstFlopBet].seatId===lastAggressor?firstFlopBet:-1;
 const out:Record<string,HandStats>={};
 for(const {seatId,net} of h.players){
  const mine=pre.filter(a=>a.seatId===seatId);
  const s:HandStats={vpip:mine.some(a=>a.type==='call'||aggressive(a)),pfr:mine.some(aggressive),
   threeBetOpp:false,threeBet:false,foldTo3BetOpp:false,foldTo3Bet:false,cbetOpp:false,cbet:false,foldToCbetOpp:false,foldToCbet:false,
   sawFlop:reachedFlop&&!foldedPre.has(seatId),wentToShowdown:false,wonAtShowdown:false};
  // 3-bet chance: the player's decision while exactly one raise (the open) is in front.
  let raises=0;
  for(const a of pre){
   if(a.seatId===seatId){
    if(raises===1&&a.seatId!==opener&&!s.threeBetOpp){s.threeBetOpp=true;s.threeBet=aggressive(a);}
    if(raises===2&&a.seatId===opener&&!s.foldTo3BetOpp){s.foldTo3BetOpp=true;s.foldTo3Bet=a.type==='fold';}
   }
   if(aggressive(a))raises++;
  }
  if(s.sawFlop&&seatId===lastAggressor){
   // C-bet chance: the aggressor's first flop decision with no bet in front of it.
   const first=flop.findIndex(a=>a.seatId===seatId);
   if(first>=0&&(firstFlopBet<0||firstFlopBet>=first)){s.cbetOpp=true;s.cbet=aggressive(flop[first]);}
  }
  if(cbetIndex>=0&&seatId!==lastAggressor){
   const reply=flop.findIndex((a,i)=>i>cbetIndex&&a.seatId===seatId);
   if(reply>=0){s.foldToCbetOpp=true;s.foldToCbet=flop[reply].type==='fold';}
  }
  const foldedAtAll=h.actions.some(a=>a.seatId===seatId&&a.type==='fold');
  s.wentToShowdown=s.sawFlop&&h.result.showdown&&!foldedAtAll;
  s.wonAtShowdown=s.wentToShowdown&&(h.result.winners.includes(seatId)||net>0);
  out[seatId]=s;
 }
 return out;
}

/** 「GTOと対戦」練習モード (owner 2026/10/30: GTO Wizard の Trainer のように、GTOのCPU5人と1ハンド通して打ち、
 * 1手ごとに採点。自分のカードは見えて、座る場所は毎ハンド自動で変わる).
 * Pure hand engine for the trainer table: six seats, 100BB each every hand (cash, no ante), the button moves one seat
 * every hand so the hero plays every position in turn, and the deal comes from a seed so a hand can be replayed. */
import {applyBettingAction,beginNextBettingStreet,legalBettingActions,potTotal,type BettingAction,type BettingRound} from './betting';
import {createDeck,type Card} from './engine';
import {positionsFor,type GtoView,type LoggedAction,type Pos,type Street} from './gto-bot';
import {settleCompletedHand} from './hand-settlement';
import {ringTerms,startForcedHand} from './tournament-hand';

export const HERO='you';
/** Clockwise seat order; the hero sits at index 0. */
export const TRAINER_SEATS=[HERO,'c1','c2','c3','c4','c5'] as const;
export const TRAINER_BB=ringTerms.bb;
export const TRAINER_STACK=100*TRAINER_BB;
const STREETS:Street[]=['preflop','flop','turn','river'];

export type TrainerResult={showdown:boolean;payouts:Record<string,number>;winners:string[]};
export type TrainerHand={
 seed:number;
 /** Hero's position this hand. */
 heroPos:Pos;
 button:string;
 positions:Record<string,Pos>;
 board:Card[];holes:Record<string,[Card,Card]>;
 round:BettingRound;street:number;log:LoggedAction[];
 startStacks:Record<string,number>;
 result:TrainerResult|null;
};

/** Small deterministic generator (mulberry32) so "同じハンドをやり直す" deals the same cards. */
export function seededRandom(seed:number){let a=seed>>>0;return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

/** Hand number n puts the button n seats after the hero, so the hero moves BTN → CO → HJ → UTG → BB → SB (one seat per hand, as at a real table). */
export function buttonIndexFor(handNo:number){return ((handNo%6)+6)%6;}

export function startTrainerHand(seed:number,buttonIndex:number):TrainerHand{
 const ids=[...TRAINER_SEATS],random=seededRandom(seed),deck=createDeck();
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const holes:Record<string,[Card,Card]>={};ids.forEach((id,i)=>{holes[id]=[deck[i],deck[i+6]];});
 const board=deck.slice(12,17);
 const start=startForcedHand(ids.map(id=>({id,stack:TRAINER_STACK})),buttonIndex,ringTerms);
 const positions=positionsFor(ids,start.positions);
 return {seed,heroPos:positions[HERO],button:start.positions.button,positions,board,holes,round:start.round,street:0,log:[],
  startStacks:Object.fromEntries(ids.map(id=>[id,TRAINER_STACK])),result:null};
}

/** Board cards visible on the current street. */
export function visibleBoard(h:TrainerHand){return h.board.slice(0,h.street===0?0:h.street+2);}

/** The decision point of player `id` as the GTO model sees it (own cards plus the public record). */
export function trainerView(h:TrainerHand,id:string):GtoView|null{
 const legal=legalBettingActions(h.round,id);if(!legal||h.result)return null;
 return {handKey:`trainer-${h.seed}`,bb:TRAINER_BB,hero:id,hole:h.holes[id],board:visibleBoard(h),positions:h.positions,
  players:h.round.players.map(p=>({id:p.id,stack:p.stack,committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded,allIn:p.allIn})),
  legal:{check:legal.check,call:legal.call,callAmount:legal.callAmount,raise:legal.raise,minRaiseTo:legal.minRaiseTo,maxRaiseTo:legal.maxRaiseTo},
  log:h.log,startStacks:h.startStacks};
}

/** First player still able to bet, clockwise after the button. */
function firstAfterButton(h:TrainerHand,round:BettingRound){
 const ids=[...TRAINER_SEATS],start=ids.indexOf(h.button as typeof ids[number]);
 for(let n=1;n<=ids.length;n++){const p=round.players.find(x=>x.id===ids[(start+n)%ids.length]);if(p&&!p.folded&&!p.allIn)return p.id;}
 return null;
}

/** Apply one action; finishes streets and settles the hand when betting is over. */
export function trainerAct(h:TrainerHand,id:string,action:BettingAction):TrainerHand{
 if(h.result||h.round.toAct!==id)throw new Error('Not this player\'s turn');
 const before=h.round,me=before.players.find(p=>p.id===id)!;
 let round=applyBettingAction(before,id,action);
 const now=round.players.find(p=>p.id===id)!;
 const entry:LoggedAction={street:STREETS[h.street],id,type:action.type,to:now.committed,allIn:now.allIn,potBefore:potTotal(before),currentBetBefore:before.currentBet,committedBefore:me.committed};
 let street=h.street,result:TrainerResult|null=null;
 const next={...h,log:[...h.log,entry]};
 while(round.toAct===null){
  result=settleCompletedHand(round,h.board,h.holes,[...TRAINER_SEATS],h.button,street>=3);
  if(result)break;
  street++;
  const first=firstAfterButton(h,round);
  if(!first){result=settleCompletedHand(round,h.board,h.holes,[...TRAINER_SEATS],h.button,true);break;}
  round=beginNextBettingStreet(round,first);
 }
 // A showdown reveals the whole board (also when everyone is all in before the river).
 return {...next,round,street:result?.showdown?3:street,result};
}

/** Chips won or lost by `id` this hand, in big blinds. */
export function netBB(h:TrainerHand,id:string){
 if(!h.result)return 0;const p=h.round.players.find(x=>x.id===id)!;
 return Math.round(((h.result.payouts[id]??0)-p.totalCommitted)/TRAINER_BB*10)/10;
}

// ---------- grading ----------
export type TrainerLevel='best'|'correct'|'inaccurate'|'mistake'|'blunder';
/** Our own grade names (owner 2026/10/30). */
export const LEVEL_TEXT:Record<TrainerLevel,string>={best:'◎完璧',correct:'○良い',inaccurate:'△惜しい',mistake:'×ミス',blunder:'××大きなミス'};
export const TRAINER_LEVELS:TrainerLevel[]=['best','correct','inaccurate','mistake','blunder'];
/** Graded by how often GTO takes the chosen action with this hand here (frequencies, not EV):
 * the most frequent choice is ◎完璧, 25% or more ○良い, 8% or more △惜しい, 2% or more ×ミス, below that ××大きなミス.
 * The score is the chosen frequency relative to the most frequent one (0〜100). */
export function gradeChoice(freqs:readonly number[],chosen:number):{level:TrainerLevel;score:number;freq:number}{
 const total=freqs.reduce((s,x)=>s+Math.max(0,x),0)||1,f=freqs.map(x=>Math.max(0,x)/total),top=Math.max(...f),freq=f[chosen]??0;
 const level:TrainerLevel=freq>=top-0.02&&freq>0?'best':freq>=0.25?'correct':freq>=0.08?'inaccurate':freq>=0.02?'mistake':'blunder';
 return {level,score:top>0?Math.round(Math.min(1,freq/top)*100):0,freq};
}

/** EV loss of the chosen option in big blinds: the best option's EV minus the chosen one's (0 when it is the best).
 * Null unless every option has an EV (only the preflop chart has them so far). */
export function evLoss(options:readonly {ev?:number}[],chosen:number):number|null{
 if(!options.length||options.some(o=>typeof o.ev!=='number'||!Number.isFinite(o.ev))||!options[chosen])return null;
 const best=Math.max(...options.map(o=>o.ev as number));
 return Math.max(0,Math.round((best-(options[chosen].ev as number))*100)/100);
}

// ---------- practice spots (「練習の始め方」2026/10/30, GTO Wizard の Trainer に合わせて) ----------
export type TrainerMode='all'|'rfi'|'vsOpen'|'vs3bet'|'flop';
export const MODE_TEXT:Record<TrainerMode,string>={all:'最初から（すべての場面）',rfi:'オープンするか（誰も参加していない）',vsOpen:'オープンされた',vs3bet:'オープンして3ベットされた',flop:'フロップから'};
/** Positions where the mode can happen for the hero. */
export const MODE_POSITIONS:Record<TrainerMode,Pos[]>={all:['BTN','CO','HJ','UTG','BB','SB'],rfi:['UTG','HJ','CO','BTN','SB'],vsOpen:['HJ','CO','BTN','SB','BB'],vs3bet:['UTG','HJ','CO','BTN','SB'],flop:['BTN','CO','HJ','UTG','BB','SB']};
const raisesBefore=(h:TrainerHand)=>h.log.filter(a=>a.street==='preflop'&&(a.type==='raise'||a.type==='bet')).length;
/** Deal from `seed` and let everyone (the hero too, until the spot) play GTO until the hero reaches the chosen spot.
 * `decide` is the GTO bot. Returns null when this deal never reaches the spot (try the next seed). */
export function reachSpot(seed:number,buttonIndex:number,mode:TrainerMode,decide:(h:TrainerHand,id:string)=>BettingAction):TrainerHand|null{
 let h=startTrainerHand(seed,buttonIndex);
 if(mode==='all')return h;
 let heroActs=0;
 for(let guard=0;guard<60&&!h.result;guard++){
  const id=h.round.toAct;if(!id)return null;
  if(id===HERO){
   const r=raisesBefore(h),limps=h.log.some(a=>a.street==='preflop'&&a.type==='call');
   if(mode==='rfi')return heroActs===0&&r===0&&!limps?h:null;
   if(mode==='vsOpen')return heroActs===0&&r===1?h:null;
   if(mode==='vs3bet'){
    if(heroActs===0){if(r!==0||limps)return null;const a=decide(h,id);if(a.type!=='raise'&&a.type!=='bet')return null;h=trainerAct(h,id,a);heroActs++;continue;}
    return r===2&&h.street===0?h:null;
   }
   if(mode==='flop'&&h.street>=1)return h;
   const a=decide(h,id);h=trainerAct(h,id,a);heroActs++;
   if(h.round.players.find(p=>p.id===HERO)!.folded)return null;
   continue;
  }
  h=trainerAct(h,id,decide(h,id));
  if(mode==='vs3bet'&&heroActs>0&&h.round.players.find(p=>p.id===HERO)!.folded)return null;
 }
 return null;
}

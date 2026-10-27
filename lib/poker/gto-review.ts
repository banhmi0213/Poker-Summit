/** GTO review of the viewer's own decisions in a finished hand (2026/10/27).
 * Uses only what the viewer may see: their own hole cards, the public actions and the board.
 * Opponent ranges come from the model (preflop chart, flop solutions), never from their real cards. */
import type {Card} from './engine';
import type {HistoryAction} from './hand-history';
import {gtoStrategy,positionsFor,type GtoData,type GtoView,type LoggedAction,type Pos} from './gto-bot';

export type GtoReviewHand={handId:string;terms:{bb:number};buttonSeatId:string;board:Card[];actions:HistoryAction[];
 players:{seatId:string;seat:number;startStack:number;you:boolean;hole:Card[]|null}[]};
export type GtoVerdict='gto'|'mixed'|'rare';
export type GtoReview={index:number;street:HistoryAction['street'];
 /** Options with model frequency (0〜1), best first is NOT guaranteed: kept in model order. */
 options:{text:string;freq:number}[];
 /** Frequency of what was actually played; null when the action did not map onto an option. */
 played:number|null;verdict:GtoVerdict|null;source:'preflop'|'flop'|'solver'}
 |{index:number;street:HistoryAction['street'];source:'none';reason:string};

const boardCount={preflop:0,flop:3,turn:4,river:5} as const;
const forced=new Set(['ante','sb','bb']);
/** Played ≥30%: GTO通り, 5〜30%: ときどき, under 5%: ほぼやらない. */
export function gtoVerdict(freq:number):GtoVerdict{return freq>=0.3?'gto':freq>=0.05?'mixed':'rare';}
export const verdictText:Record<GtoVerdict,string>={gto:'GTO通り',mixed:'ときどき',rare:'ほぼやらない'};
export const reasonText=(reason:string)=>reason==='stack-depth'?'スタックが浅すぎる・深すぎるため対象外':reason==='multiway'?'3人以上のポットは対象外':reason.startsWith('preflop-off')?'GTOの表にない進行のため対象外':reason==='no-flop-data'?'このフロップは計算中':'GTOの計算範囲外';

function optionText(kind:string,label:string,to:number|null,bb:number){
 if(kind==='fold')return 'フォールド';if(kind==='check')return 'チェック';if(kind==='call')return 'コール';if(kind==='allin')return 'オールイン';
 if(label&&/%|倍/.test(label))return `${kind==='bet'?'ベット':'レイズ'} ${label}`;
 return `${kind==='bet'?'ベット':'レイズ'}${to!==null&&Number.isFinite(to)?` ${Math.round(to/bb*10)/10}BB`:''}`;
}

/** Rebuild the decision point before action `index` from the public record. */
export function viewAt(hand:GtoReviewHand,index:number):GtoView|null{
 const me=hand.players.find(p=>p.you);if(!me?.hole||me.hole.length!==2)return null;
 const a=hand.actions[index],before=hand.actions.slice(0,index),bb=hand.terms.bb;
 const board=hand.board.slice(0,boardCount[a.street]);if(board.length!==boardCount[a.street])return null;
 const order=[...hand.players].sort((x,y)=>x.seat-y.seat).map(p=>p.seatId);
 const sb=hand.actions.find(x=>x.type==='sb')?.seatId??null,bbSeat=hand.actions.find(x=>x.type==='bb')?.seatId;if(!bbSeat)return null;
 const positions:Record<string,Pos>=positionsFor(order,{button:hand.buttonSeatId,sb,bb:bbSeat});
 const paid=new Map<string,number>(),street=new Map<string,number>(),folded=new Set<string>(),allIn=new Set<string>(),log:LoggedAction[]=[];
 let pot=0;
 before.forEach((b,bi)=>{
  paid.set(b.seatId,(paid.get(b.seatId)??0)+b.amount);
  if(b.allIn)allIn.add(b.seatId);if(b.type==='fold')folded.add(b.seatId);
  if(!forced.has(b.type)){
   const streetBefore=new Map<string,number>();for(const c of before.slice(0,bi))if(c.street===b.street&&c.type!=='ante')streetBefore.set(c.seatId,c.to);
   log.push({street:b.street,id:b.seatId,type:b.type as LoggedAction['type'],to:b.to,allIn:b.allIn,potBefore:pot,currentBetBefore:Math.max(0,...streetBefore.values()),committedBefore:streetBefore.get(b.seatId)??0});
  }
  pot=b.pot;
 });
 for(const b of before)if(b.street===a.street&&b.type!=='ante')street.set(b.seatId,b.to);
 const players=hand.players.map(p=>{const spent=paid.get(p.seatId)??0;return {id:p.seatId,stack:p.startStack-spent,committed:street.get(p.seatId)??0,totalCommitted:spent,folded:folded.has(p.seatId),allIn:allIn.has(p.seatId)};});
 const self=players.find(p=>p.id===me.seatId)!,currentBet=Math.max(0,...street.values()),toCall=Math.max(0,Math.min(currentBet-self.committed,self.stack));
 return {handKey:'review:'+hand.handId,bb,hero:me.seatId,hole:me.hole,board,positions,players,
  legal:{check:toCall===0,call:toCall>0,callAmount:toCall,raise:self.stack>toCall,minRaiseTo:null,maxRaiseTo:null},log,
  startStacks:Object.fromEntries(hand.players.map(p=>[p.seatId,p.startStack]))};
}

export function reviewGto(hand:GtoReviewHand,data:GtoData,budgetMs=1500):GtoReview[]{
 const me=hand.players.find(p=>p.you);if(!me?.hole||me.hole.length!==2)return [];
 const out:GtoReview[]=[];
 hand.actions.forEach((a,i)=>{
  if(a.seatId!==me.seatId||forced.has(a.type))return;
  const v=viewAt(hand,i);if(!v)return;
  const s=gtoStrategy(v,data,budgetMs);
  if(s.source==='fallback'){out.push({index:i,street:a.street,source:'none',reason:s.reason});return;}
  const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1,freqs=s.freqs.map(x=>Math.max(0,x)/total);
  const played:LoggedAction={street:a.street,id:a.seatId,type:a.type as LoggedAction['type'],to:a.to,allIn:a.allIn,potBefore:i>0?hand.actions[i-1].pot:0,
   currentBetBefore:Math.max(0,...v.players.map(p=>p.committed)),committedBefore:v.players.find(p=>p.id===a.seatId)!.committed};
  const j=s.indexOf(played),freq=j>=0?freqs[j]:null;
  out.push({index:i,street:a.street,source:s.source,options:s.options.map((o,k)=>({text:optionText(o.kind,o.label,o.to,hand.terms.bb),freq:freqs[k]})),played:freq,verdict:freq===null?null:gtoVerdict(freq)});
 });
 return out;
}

/** GTO advice for a live decision (practice table hint, 2026/10/27): the hero's options with frequencies, most frequent first. */
export type GtoAdvice={source:'preflop'|'flop'|'solver';options:{text:string;freq:number}[]}|{source:'none';reason:string};
export function adviseGto(v:GtoView,data:GtoData,budgetMs=2500):GtoAdvice{
 const s=gtoStrategy(v,data,budgetMs);
 if(s.source==='fallback')return {source:'none',reason:s.reason};
 const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1;
 return {source:s.source,options:s.options.map((o,k)=>({text:optionText(o.kind,o.label,o.to,v.bb),freq:Math.max(0,s.freqs[k])/total})).filter(o=>o.freq>=0.005).sort((a,b)=>b.freq-a.freq)};
}

/** Review of decisions captured live (practice table, 2026/10/27: ハンド後にその場で「GTOで振り返る」): each item is the
 * decision point as it was when the hero acted, plus what was played. */
export type LiveDecision={view:GtoView;played:LoggedAction};
export type LiveReview={street:LoggedAction['street'];played:string;options:{text:string;freq:number}[];freq:number|null;verdict:GtoVerdict|null;source:'preflop'|'flop'|'solver'}
 |{street:LoggedAction['street'];played:string;source:'none';reason:string};
const playedText=(a:LoggedAction,bb:number)=>a.type==='fold'?'フォールド':a.type==='check'?'チェック':a.type==='call'?'コール':`${a.type==='bet'?'ベット':'レイズ'} ${Math.round(a.to/bb*10)/10}BB${a.allIn?'（オールイン）':''}`;
export function reviewLive(items:readonly LiveDecision[],data:GtoData,budgetMs=1500):LiveReview[]{
 return items.map(({view,played})=>{
  const text=playedText(played,view.bb),s=gtoStrategy(view,data,budgetMs);
  if(s.source==='fallback')return {street:played.street,played:text,source:'none',reason:s.reason};
  const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1,freqs=s.freqs.map(x=>Math.max(0,x)/total),j=s.indexOf(played),freq=j>=0?freqs[j]:null;
  return {street:played.street,played:text,source:s.source,freq,verdict:freq===null?null:gtoVerdict(freq),
   options:s.options.map((o,k)=>({text:optionText(o.kind,o.label,o.to,view.bb),freq:freqs[k]})).filter(o=>o.freq>=0.005).sort((a,b)=>b.freq-a.freq)};
 });
}

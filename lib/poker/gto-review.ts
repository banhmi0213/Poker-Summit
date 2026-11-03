/** GTO review of the viewer's own decisions in a finished hand (2026/10/27).
 * Uses only what the viewer may see: their own hole cards, the public actions and the board.
 * Opponent ranges come from the model (preflop chart, flop solutions), never from their real cards. */
import type {Card} from './engine';
import type {HistoryAction} from './hand-history';
import {gtoStrategy,positionsFor,type GtoData,type GtoGrid,type GtoView,type LoggedAction,type Pos} from './gto-bot';
import {classOf} from './solver-view';
import {HAND_CATEGORIES,combosOfClass,handCategory,type HandCategory} from './hand-category';
import {recordRow,type GtoRecordRow,type GtoRecordSource} from './gto-record';

export type GtoReviewHand={handId:string;terms:{bb:number};buttonSeatId:string;board:Card[];actions:HistoryAction[];
 /** Table rake (ring hands): judged with that rake's preflop chart. */rake?:{bps:number;capBb:number};
 players:{seatId:string;seat:number;startStack:number;you:boolean;hole:Card[]|null}[]};
export type GtoVerdict='gto'|'mixed'|'rare';
/** The whole range at a reviewed decision, for the 13×13 chart (options in model order). */
export type GtoRange={options:{text:string;kind:string}[];grid:GtoGrid;hero:string;nearFlop?:string;proxySpot?:string;
 /** 近似値: four or more players (2026/10/30). */
 approx?:boolean;
 /** Board card codes after the flop (for the hand-strength breakdown); absent preflop. */
 board?:number[]};
export type GtoReview={index:number;street:HistoryAction['street'];
 /** Options with model frequency (0〜1), best first is NOT guaranteed: kept in model order. */
 options:{text:string;freq:number;kind:string}[];
 /** Frequency of what was actually played; null when the action did not map onto an option. */
 played:number|null;verdict:GtoVerdict|null;source:'preflop'|'flop'|'solver';range?:GtoRange;
 /** 近似値 (four or more players): shown as a guide, never graded (verdict null). */
 approx?:boolean}
 |{index:number;street:HistoryAction['street'];source:'none';reason:string};

const boardCount={preflop:0,flop:3,turn:4,river:5} as const;
const forced=new Set(['ante','sb','bb']);
/** Played ≥30%: GTO通り, 5〜30%: ときどき, under 5%: ほぼやらない. */
export function gtoVerdict(freq:number):GtoVerdict{return freq>=0.3?'gto':freq>=0.05?'mixed':'rare';}
export const verdictText:Record<GtoVerdict,string>={gto:'GTO通り',mixed:'ときどき',rare:'ほぼやらない'};
export const reasonText=(reason:string)=>reason==='multiway-4'?'4人以上のポットは近似値のみ（集計・採点の対象外）':reason==='stack-depth'?'スタックが浅すぎる・深すぎるため対象外':reason==='multiway'?'3人以上のポットは対象外':reason==='no-flop-data'?'この場面のフロップはまだ計算中':reason.startsWith('preflop-off')?'GTOの表にない進行のため対象外':reason==='no-flop-data'?'このフロップは計算中':'GTOの計算範囲外';

function optionText(kind:string,label:string,to:number|null,bb:number){
 if(kind==='fold')return 'フォールド';if(kind==='check')return 'チェック';if(kind==='call')return 'コール';if(kind==='allin')return 'オールイン';
 if(label&&/^(ベット|レイズ)/.test(label))return label;
 if(label&&/%|倍/.test(label))return `${kind==='bet'?'ベット':'レイズ'} ${label}`;
 return `${kind==='bet'?'ベット':'レイズ'}${to!==null&&Number.isFinite(to)?` ${Math.round(to/bb*10)/10}BB`:''}`;
}

/** Rebuild the decision point before action `index` from the public record. */
export function viewAt(hand:GtoReviewHand,index:number,seatId?:string):GtoView|null{
 // seatId: build the decision for another player (range only, 2026/10/29); their cards are never used.
 const me=seatId?hand.players.find(p=>p.seatId===seatId):hand.players.find(p=>p.you);if(!me)return null;
 const hole=seatId&&!me.you?[]:me.hole;if(!seatId&&(!hole||hole.length!==2))return null;
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
 return {handKey:'review:'+hand.handId,bb,hero:me.seatId,hole:hole??[],board,positions,players,
  legal:{check:toCall===0,call:toCall>0,callAmount:toCall,raise:self.stack>toCall,minRaiseTo:null,maxRaiseTo:null},log,
  startStacks:Object.fromEntries(hand.players.map(p=>[p.seatId,p.startStack])),...(hand.rake?{rake:hand.rake}:{})};
}

function rangeOf(s:{grid?:GtoGrid;nearFlop?:string;proxySpot?:string;approx?:boolean},options:{text:string;kind:string}[],hole:Card[],board:readonly Card[]=[]):GtoRange|undefined{
 if(!s.grid)return undefined;
 const code=(c:Card)=>(c.rank-2)*4+'cdhs'.indexOf(c.suit);
 return {options:options.map(o=>({text:o.text,kind:o.kind})),grid:s.grid,hero:hole.length===2?classOf(code(hole[0]),code(hole[1])):'',nearFlop:s.nearFlop,proxySpot:s.proxySpot,approx:s.approx,board:board.length>=3?board.map(code):undefined};
}
export function reviewGto(hand:GtoReviewHand,data:GtoData,budgetMs=1500,streets?:readonly HistoryAction['street'][],opts:{noApprox?:boolean}={}):GtoReview[]{
 const me=hand.players.find(p=>p.you);if(!me?.hole||me.hole.length!==2)return [];
 const out:GtoReview[]=[];
 hand.actions.forEach((a,i)=>{
  if(a.seatId!==me.seatId||forced.has(a.type)||(streets&&!streets.includes(a.street)))return;
  const v=viewAt(hand,i);if(!v)return;
  const s=gtoStrategy(v,data,budgetMs,false,opts);
  if(s.source==='fallback'){out.push({index:i,street:a.street,source:'none',reason:s.reason});return;}
  const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1,freqs=s.freqs.map(x=>Math.max(0,x)/total);
  const played:LoggedAction={street:a.street,id:a.seatId,type:a.type as LoggedAction['type'],to:a.to,allIn:a.allIn,potBefore:i>0?hand.actions[i-1].pot:0,
   currentBetBefore:Math.max(0,...v.players.map(p=>p.committed)),committedBefore:v.players.find(p=>p.id===a.seatId)!.committed};
  // Before the flop the chart lists every action GTO takes: a play outside it (e.g. a limp from the button) is 0%.
  const j=s.indexOf(played),freq=j>=0?freqs[j]:s.source==='preflop'?0:null;
  const options=s.options.map((o,k)=>({text:optionText(o.kind,o.label,o.to,hand.terms.bb),freq:freqs[k],kind:o.kind}));
  out.push({index:i,street:a.street,source:s.source,options,played:freq,verdict:freq===null||s.approx?null:gtoVerdict(freq),range:rangeOf(s,options,me.hole,v.board),approx:s.approx});
 });
 return out;
}

/** GTO records for one finished hand (owner 2026/11/1「全部から収集」): one row per graded decision of the member, with
 * ref = the hand id and step = the action's index, so a hand sent twice is kept once. A preflop play outside the chart
 * counts as 0%. 4人以上のポット (approximate) and spots without data are left out. */
export function recordRows(hand:GtoReviewHand,data:GtoData,source:GtoRecordSource,budgetMs=1500,streets?:readonly HistoryAction['street'][]):GtoRecordRow[]{
 const me=hand.players.find(p=>p.you);if(!me?.hole||me.hole.length!==2)return [];
 const out:GtoRecordRow[]=[];
 hand.actions.forEach((a,i)=>{
  if(a.seatId!==me.seatId||forced.has(a.type)||(streets&&!streets.includes(a.street)))return;
  const v=viewAt(hand,i);if(!v)return;
  const s=gtoStrategy(v,data,budgetMs,false,{noApprox:true,withEv:true});
  if(s.source==='fallback'||s.approx)return;
  const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1,freqs=s.freqs.map(x=>Math.max(0,x)/total);
  const played:LoggedAction={street:a.street,id:a.seatId,type:a.type as LoggedAction['type'],to:a.to,allIn:a.allIn,potBefore:i>0?hand.actions[i-1].pot:0,
   currentBetBefore:Math.max(0,...v.players.map(p=>p.committed)),committedBefore:v.players.find(p=>p.id===a.seatId)!.committed};
  const j=s.indexOf(played);if(j<0&&s.source!=='preflop')return;
  const best=freqs.indexOf(Math.max(...freqs)),ev=s.ev,loss=j<0||!ev||ev.some(x=>!Number.isFinite(x))?null:j===best?0:Math.max(0,Math.max(...ev)-ev[j]);
  out.push(recordRow(v,source,{freqs:j<0?[...freqs,0]:freqs,chosen:j<0?freqs.length:j,action:playedOf(hand,i),evLoss:loss,seats:hand.players.length,ref:hand.handId,step:i}));
 });
 return out;
}

/** GTO records for the CPU practice table's decisions (owner 2026/11/1): the same rows as recordRows, from the live
 * decisions kept during the hand; ref = the saved practice hand's id. */
export function liveRecordRows(items:readonly LiveDecision[],data:GtoData,ref:string,budgetMs=1500):GtoRecordRow[]{
 const out:GtoRecordRow[]=[];
 items.forEach(({view,played},step)=>{
  const s=gtoStrategy(view,data,budgetMs,false,{noApprox:true,withEv:true});
  if(s.source==='fallback'||s.approx)return;
  const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1,freqs=s.freqs.map(x=>Math.max(0,x)/total),j=s.indexOf(played);
  if(j<0&&s.source!=='preflop')return;
  const best=freqs.indexOf(Math.max(...freqs)),ev=s.ev,loss=j<0||!ev||ev.some(x=>!Number.isFinite(x))?null:j===best?0:Math.max(0,Math.max(...ev)-ev[j]);
  out.push(recordRow(view,'practice',{freqs:j<0?[...freqs,0]:freqs,chosen:j<0?freqs.length:j,action:playedText(played,view.bb),evLoss:loss,ref,step}));
 });
 return out;
}

/** GTO advice for a live decision (practice table hint, 2026/10/27): the hero's options with frequencies, most frequent first. */
export type GtoAdvice={source:'preflop'|'flop'|'solver';options:{text:string;freq:number}[];approx?:boolean}|{source:'none';reason:string};
export function adviseGto(v:GtoView,data:GtoData,budgetMs=2500):GtoAdvice{
 const s=gtoStrategy(v,data,budgetMs);
 if(s.source==='fallback')return {source:'none',reason:s.reason};
 const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1;
 return {source:s.source,approx:s.approx,options:s.options.map((o,k)=>({text:optionText(o.kind,o.label,o.to,v.bb),freq:Math.max(0,s.freqs[k])/total})).filter(o=>o.freq>=0.005).sort((a,b)=>b.freq-a.freq)};
}

/** The hero's GTO menu at a live decision (「GTOと対戦」2026/10/30): every option with its table action text, its
 * frequency for the hero's hand, and what to send to the table (kind/label/to for toTable). The buttons are this menu,
 * so whatever the hero picks can be graded. */
export type TrainerSpot={source:'preflop'|'flop'|'solver';options:{text:string;kind:string;label:string;to:number|null;freq:number;
 /** EV of this option for the hero's hand in big blinds, where known (preflop chart). */ev?:number}[];nearFlop?:string;proxySpot?:string;approx?:boolean}|{source:'none';reason:string};
export function trainerSpot(v:GtoView,data:GtoData,budgetMs=2500):TrainerSpot{
 const s=gtoStrategy(v,data,budgetMs,false,{withEv:true});
 if(s.source==='fallback')return {source:'none',reason:s.reason};
 const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1;
 const options:{text:string;kind:string;label:string;to:number|null;freq:number;ev?:number}[]=s.options.map((o,k)=>({text:optionText(o.kind,o.label,o.to,v.bb),kind:o.kind,label:o.label,to:o.to,freq:Math.max(0,s.freqs[k])/total,...(s.ev?{ev:s.ev[k]}:{})}));
 // The buttons are GTO's own menu (as in GTO Wizard), so the hand stays on the computed tree. Only when the chart has a
 // single line here (e.g. fold only) are the other legal lines offered too, at 0%, so the hero still has a choice.
 const has=(...k:string[])=>options.some(o=>k.includes(o.kind)),add=(kind:string)=>options.push({text:optionText(kind,'',null,v.bb),kind,label:'',to:null,freq:0});
 if(options.length>=2)return {source:s.source,nearFlop:s.nearFlop,proxySpot:s.proxySpot,approx:s.approx,options};
 if(v.legal.check&&!has('check','call'))add('check');
 if(v.legal.call&&v.legal.callAmount>0&&!has('call'))add('call');
 if(!v.legal.check&&!has('fold'))add('fold');
 if(v.legal.raise&&!has('raise','bet','allin'))add('allin');
 return {source:s.source,nearFlop:s.nearFlop,proxySpot:s.proxySpot,approx:s.approx,options};
}

/** Review of decisions captured live (practice table, 2026/10/27: ハンド後にその場で「GTOで振り返る」): each item is the
 * decision point as it was when the hero acted, plus what was played. */
export type LiveDecision={view:GtoView;played:LoggedAction};
export type LiveReview={street:LoggedAction['street'];played:string;options:{text:string;freq:number}[];freq:number|null;verdict:GtoVerdict|null;source:'preflop'|'flop'|'solver';range?:GtoRange;approx?:boolean}
 |{street:LoggedAction['street'];played:string;source:'none';reason:string};
const playedText=(a:LoggedAction,bb:number)=>a.type==='fold'?'フォールド':a.type==='check'?'チェック':a.type==='call'?'コール':`${a.type==='bet'?'ベット':'レイズ'} ${Math.round(a.to/bb*10)/10}BB${a.allIn?'（オールイン）':''}`;
export function reviewLive(items:readonly LiveDecision[],data:GtoData,budgetMs=1500):LiveReview[]{
 return items.map(({view,played})=>{
  const text=playedText(played,view.bb),s=gtoStrategy(view,data,budgetMs);
  if(s.source==='fallback')return {street:played.street,played:text,source:'none',reason:s.reason};
  const total=s.freqs.reduce((t,x)=>t+Math.max(0,x),0)||1,freqs=s.freqs.map(x=>Math.max(0,x)/total),j=s.indexOf(played),freq=j>=0?freqs[j]:s.source==='preflop'?0:null;
  const all=s.options.map((o,k)=>({text:optionText(o.kind,o.label,o.to,view.bb),freq:freqs[k],kind:o.kind}));
  return {street:played.street,played:text,source:s.source,freq,approx:s.approx,verdict:freq===null||s.approx?null:gtoVerdict(freq),range:rangeOf(s,all,view.hole,view.board),
   options:all.filter(o=>o.freq>=0.005).sort((a,b)=>b.freq-a.freq).map(({text,freq})=>({text,freq}))};
 });
}

/** How far the viewer's play strays from GTO over many hands (2026/10/29: 成績・癖の分析の「GTOから外れた率」).
 * Preflop and flop only (precomputed data, no solving), so a hundred hands take well under a second.
 * A decision counts as off when GTO plays it under 5% (ほぼやらない). */
export type DeviationStreet={judged:number;gto:number;mixed:number;rare:number};
export type DeviationSummary={hands:number;preflop:DeviationStreet;flop:DeviationStreet;
 /** The most clearly off decisions, rarest first (at most 8). */
 worst:{handId:string;street:'preflop'|'flop';played:string;freq:number;best:string}[]};
export function summarizeDeviation(hands:readonly GtoReviewHand[],data:GtoData):DeviationSummary{
 const zero=():DeviationStreet=>({judged:0,gto:0,mixed:0,rare:0});
 const out:DeviationSummary={hands:0,preflop:zero(),flop:zero(),worst:[]};
 for(const h of hands){
  const rs=reviewGto(h,data,0,['preflop','flop'],{noApprox:true});let counted=false;
  for(const r of rs){if(r.source==='none'||!r.verdict||r.played===null||(r.street!=='preflop'&&r.street!=='flop'))continue;
   const st=out[r.street];st.judged++;st[r.verdict]++;counted=true;
   if(r.verdict==='rare'){const best=[...r.options].sort((a,b)=>b.freq-a.freq)[0];
    out.worst.push({handId:h.handId,street:r.street,played:playedOf(h,r.index),freq:r.played,best:best?`${best.text} ${Math.round(best.freq*100)}%`:''});}
  }
  if(counted)out.hands++;
 }
 out.worst.sort((a,b)=>a.freq-b.freq);out.worst=out.worst.slice(0,8);
 return out;
}
/** Per-hand GTO flags (2026/10/30: Olympia のように全ハンドを自動で判定し、一覧に「!」と絞り込み). Off = GTO plays it
 * under 5% with this hand (ほぼやらない). streets: preflop/flop are instant (precomputed); turn/river solve live. */
export type HandFlags={handId:string;pre:{judged:number;off:number};post:{judged:number;off:number};
 offs:{index:number;street:HistoryAction['street'];played:string;freq:number;best:string}[]};
export function flagHand(h:GtoReviewHand,data:GtoData,streets:readonly HistoryAction['street'][]=['preflop','flop'],budgetMs=0):HandFlags{
 const out:HandFlags={handId:h.handId,pre:{judged:0,off:0},post:{judged:0,off:0},offs:[]};
 for(const r of reviewGto(h,data,budgetMs,streets,{noApprox:true})){
  if(r.source==='none'||!r.verdict||r.played===null)continue;
  const st=r.street==='preflop'?out.pre:out.post;st.judged++;
  if(r.verdict==='rare'){st.off++;const best=[...r.options].sort((a,b)=>b.freq-a.freq)[0];
   out.offs.push({index:r.index,street:r.street,played:playedOf(h,r.index),freq:r.played,best:best?`${best.text} ${Math.round(best.freq*100)}%`:''});}
 }
 return out;
}
function playedOf(h:GtoReviewHand,i:number){const a=h.actions[i];return a.type==='fold'?'フォールド':a.type==='check'?'チェック':a.type==='call'?'コール':`${a.type==='bet'?'ベット':'レイズ'} ${Math.round(a.to/h.terms.bb*10)/10}BB${a.allIn?'（オールイン）':''}`;}

/** Action shares per hand-strength category over the whole range (2026/10/29: 役の強さごとの打ち方). Weight = combos × reach. */
export function categoryBreakdown(range:GtoRange):{category:HandCategory;share:number;freqs:number[]}[]{
 if(!range.board)return [];
 const k=range.options.length,acc=new Map<HandCategory,{w:number;f:number[]}>();let total=0;
 for(const [cls,e] of Object.entries(range.grid)){if(!(e.reach>0))continue;
  for(const c of combosOfClass(cls,range.board)){const cat=handCategory(c,range.board),x=acc.get(cat)??{w:0,f:new Array(k).fill(0)};
   x.w+=e.reach;for(let a=0;a<k;a++)x.f[a]+=e.reach*(e.freqs[a]??0);acc.set(cat,x);total+=e.reach;}}
 return HAND_CATEGORIES.filter(c=>acc.has(c)).map(c=>{const x=acc.get(c)!;return {category:c,share:total>0?x.w/total:0,freqs:x.f.map(v=>x.w>0?v/x.w:0)};});
}

/** The GTO range at every other player's decision (2026/10/29: 相手のアクションでもレンジ表). Uses only the public record:
 * opponents' cards are never read, even when the history has them (shown at showdown). */
export function reviewRanges(hand:GtoReviewHand,data:GtoData,budgetMs=800):{index:number;range:GtoRange}[]{
 const out:{index:number;range:GtoRange}[]=[];
 const pub:GtoReviewHand={...hand,players:hand.players.map(p=>p.you?p:{...p,hole:null})};
 pub.actions.forEach((a,i)=>{
  const who=pub.players.find(p=>p.seatId===a.seatId);if(!who||who.you||forced.has(a.type))return;
  const v=viewAt(pub,i,a.seatId);if(!v)return;
  const s=gtoStrategy(v,data,budgetMs,true);if(s.source==='fallback'||!s.grid)return;
  const options=s.options.map(o=>({text:optionText(o.kind,o.label,o.to,hand.terms.bb),kind:o.kind}));
  const r=rangeOf(s,options,[],v.board);if(r)out.push({index:i,range:r});
 });
 return out;
}

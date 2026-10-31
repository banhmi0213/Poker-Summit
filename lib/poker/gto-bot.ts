/** GTO CPU players (owner request 2026/10/27: "全員GTO通り+めっちゃ強く").
 * Preflop: the solved 6-max chart (public/poker-gto/preflop.json), mixed strategies sampled as solved.
 * Flop (heads-up): the precomputed flop solutions (nearest computed flop of the matching spot).
 * Turn/river (heads-up): solved on the spot with PostflopSolver from both players' ranges, which are
 * narrowed through the hand by the same strategies (preflop chart → flop solution → turn solve).
 * Multiway pots, short stacks and spots outside the model fall back to the equity-based CPU, played tight-aggressive.
 * The module is pure: the caller supplies the data (fs on the server, fetch in the browser) and the action log.
 */
import type {Card} from './engine';
import type {BettingAction} from './betting';
import {decideCpuAction,type CpuStyle} from './cpu-strategy';
import {PostflopSolver,NO_CARDS,dealCard,type ActNode,type Node,type Combo} from './postflop-solver';
import {MultiwaySolver,type MActNode,type MNode} from './multiway-solver';
import {NWaySolver,type NActNode,type NNode} from './multiway-n-solver';
import rankData from '@/data/poker-gto/preflop-rank.json';
import {classOf} from './solver-view';
import {canonicalFlop,nearestFlop} from './flop-subset';
import type {FlopData,FlopNode} from './gto-spots';

export type Pos='UTG'|'HJ'|'CO'|'BTN'|'SB'|'BB';
export type Street='preflop'|'flop'|'turn'|'river';
/** One voluntary action. `to` is the actor's total committed on that street after the action (chips). */
export type LoggedAction={street:Street;id:string;type:'fold'|'check'|'call'|'bet'|'raise';to:number;allIn:boolean;potBefore:number;currentBetBefore:number;committedBefore:number};
export type PreflopNode={id:number;player:Pos;history:string;kind:string;actions:{kind:string;to?:number}[];strategy:Record<string,number[]>};
export type PreflopData={nodes:PreflopNode[]};
/** preflopHu (2026/10/29): the heads-up chart (public/poker-gto/preflop-hu.json), used when only two players are dealt in. */
/** preflopDepths (2026/10/30): 6-max tournament charts by stack (60, 40, 20, 10BB with a big blind ante). */
export type GtoData={preflop:PreflopData;preflopHu?:PreflopData;preflopDepths?:Record<number,PreflopData>;flopIndex:Record<string,string[]>;flop(spot:string,flop:string):FlopData|null;
 /** EV of each action per hand at each 100BB chart decision, in big blinds (public/poker-gto/preflop-ev.json), by node id. */
 preflopEv?:Record<number,Record<string,number[]>>};
export type PreflopEvFile={version:number;nodes:{id:number;history:string;ev:Record<string,number[]>}[]};
export const preflopEvById=(f:PreflopEvFile|null|undefined)=>f?Object.fromEntries(f.nodes.map(n=>[n.id,n.ev])) as Record<number,Record<string,number[]>>:undefined;
export const CHART_DEPTHS=[60,40,20,10];
/** The tournament chart for an effective stack: 100BB above 80BB, then the nearest of 60/40/20/10. */
export function depthChart(effective:number):number{return effective>=80?100:effective>=50?60:effective>=30?40:effective>=15?20:10;}
export type GtoView={
 handKey:string;bb:number;hero:string;hole:readonly Card[];board:readonly Card[];
 /** Position label of every player dealt in (BTN/SB/BB/UTG/HJ/CO; heads-up: button = SB). */
 positions:Readonly<Record<string,Pos>>;
 players:readonly {id:string;stack:number;committed:number;totalCommitted:number;folded:boolean;allIn:boolean}[];
 legal:{check:boolean;call:boolean;callAmount:number;raise:boolean;minRaiseTo:number|null;maxRaiseTo:number|null};
 /** Voluntary actions so far this hand, in order. */
 log:readonly LoggedAction[];
 /** Stacks (chips) when the hand started, before blinds. */
 startStacks:Readonly<Record<string,number>>;
};
export type GtoDecision={action:BettingAction;source:'preflop'|'flop'|'solver'|'fallback';
 /** Why the fallback CPU decided (for coverage stats). */
 reason?:string};

const SUITS='cdhs';
const code=(c:Card)=>(c.rank-2)*4+SUITS.indexOf(c.suit);
const key2=(a:number,b:number)=>a<b?a*52+b:b*52+a;
const POST_ORDER:Pos[]=['SB','BB','UTG','HJ','CO','BTN'],HU_POST_ORDER:Pos[]=['BB','SB'];
/** The fallback CPU: strong regular, rarely bluffs. */
const EXPERT:CpuStyle={name:'GTO補助',looseness:0.95,aggression:1.2,bluff:0.1};

// ---------- preflop chart ----------
type Tok={pos:Pos;kind:'F'|'C'|'R';to:number};
const tokRe=/^(UTG|HJ|CO|BTN|SB|BB)(F|C|AI|[\d.]+)$/;
function parseHistory(h:string):Tok[]{return h.split(' ').filter(Boolean).map(t=>{const m=tokRe.exec(t);if(!m)throw Error('bad history '+t);return {pos:m[1] as Pos,kind:m[2]==='F'?'F':m[2]==='C'?'C':'R',to:m[2]==='AI'?100:m[2]==='F'||m[2]==='C'?0:Number(m[2])};});}
/** Folds after the 3-bet are implicit in the chart; drop them so table logs and chart histories compare. */
function keyOf(toks:readonly Tok[],next:Pos){let raises=0;const out:string[]=[];for(const t of toks){if(t.kind==='F'&&raises>=2)continue;if(t.kind==='R')raises++;out.push(t.pos+t.kind);}return out.join(' ')+'>'+next;}
const chartCache=new WeakMap<PreflopData,Map<string,PreflopNode>>();
function chart(data:PreflopData){let m=chartCache.get(data);if(!m){m=new Map();for(const n of data.nodes)m.set(keyOf(parseHistory(n.history),n.player),n);chartCache.set(data,m);}return m;}
function preflopToks(v:GtoView,hu=false):Tok[]{
 // Seats missing at a short-handed table count as folds in front of the action, as the 6-max chart expects
 // (not heads-up: that chart has only SB and BB).
 const present=new Set(Object.values(v.positions)),missing=hu?[]:(['UTG','HJ','CO','BTN'] as Pos[]).filter(p=>!present.has(p)).map(pos=>({pos,kind:'F' as const,to:0}));
 return [...missing,...v.log.filter(a=>a.street==='preflop').map(a=>({pos:v.positions[a.id],kind:(a.type==='fold'?'F':a.type==='call'||a.type==='check'?'C':'R') as Tok['kind'],to:a.to/v.bb}))];
}
/** Index of the chart action that best matches what was done. */
function chartIndex(node:PreflopNode,t:Tok):number{
 if(t.kind==='F')return node.actions.findIndex(a=>a.kind==='fold');
 if(t.kind==='C')return node.actions.findIndex(a=>a.kind==='call'||a.kind==='check');
 let best=-1,d=Infinity;node.actions.forEach((a,i)=>{if(a.kind!=='raise'&&a.kind!=='allin')return;const x=Math.abs((a.to??100)-t.to);if(x<d){d=x;best=i;}});return best;
}

/** How often `node.player` arrives at `node` with each hand class, from their own earlier actions in the chart history
 * (1 = every time; the first decision of the hand is 1 for every class). For quizzes and range statistics. */
export function preflopReach(data:PreflopData,node:PreflopNode):Record<string,number>{
 const m=chart(data),toks=parseHistory(node.history),out:Record<string,number>={};
 for(const cls of Object.keys(node.strategy))out[cls]=1;
 toks.forEach((t,i)=>{
  if(t.pos!==node.player||t.kind==='F')return;
  const prev=m.get(keyOf(toks.slice(0,i),t.pos));if(!prev)return;
  const j=chartIndex(prev,t);if(j<0)return;
  for(const cls of Object.keys(out))out[cls]*=prev.strategy[cls]?.[j]??0;
 });
 return out;
}
/** The chart's history as tokens for display: position, F/C/R and the raise size in BB (all-in = 100). */
export function preflopHistory(node:PreflopNode):{pos:Pos;kind:'F'|'C'|'R';to:number}[]{return parseHistory(node.history);}

// ---------- ranges (2704 slots, a*52+b with a<b) ----------
type Ranges=Map<string,Float64Array>;
function fullRange(){const w=new Float64Array(2704);for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)w[a*52+b]=1;return w;}
function scale(w:Float64Array,f:(a:number,b:number)=>number){for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){const k=a*52+b;if(w[k]>0)w[k]*=f(a,b);}}

// ---------- spots ----------
function spotFor(v:GtoView,toks:Tok[],pair:[string,string]):string|null{
 const raises=toks.filter(t=>t.kind==='R'),open=raises[0]?.pos,low=(p:string)=>p.toLowerCase();
 // Small blind limped (2026/10/29): limped pot, or the BB raised and the SB called.
 if(toks.some(t=>t.pos==='SB'&&t.kind==='C')&&(!open||open==='BB'))return raises.length===0?'sb-limp':raises.length===1?'sb-iso':'sb-limp-3bet';
 const p=pair.map(id=>v.positions[id]);if(!open)return null;
 const other=p.find(x=>x!==open);if(!other)return null;
 if(raises.length===1){
  if(other==='BB'||other==='SB')return open==='SB'?'sb-bb':`${low(open)}-bb`;
  return open==='CO'?'co-btn':'utg-btn';
 }
 if(raises.length===2){const three=raises[1].pos;
  if(three==='BB')return open==='UTG'||open==='HJ'?'utg-bb-3bet':open==='CO'?'co-bb-3bet':'btn-bb-3bet';
  if(three==='SB')return 'btn-sb-3bet';
  return 'co-btn-3bet';
 }
 return 'btn-bb-4bet';
}
/** Heads-up spots (2026/10/29). BB acts first after the flop, as in BTN vs BB, so until a heads-up flop is computed the
 * BTN-vs-BB data of the same pot type stands in (the review says so). Limped pots have no stand-in. */
function huSpotFor(toks:Tok[]):string{
 const raises=toks.filter(t=>t.kind==='R').length,limped=toks[0]?.kind==='C';
 if(raises===0)return 'hu-limp';
 if(raises===1)return 'hu-srp';// open-call, or limp then the BB's raise called
 if(raises===2&&!limped)return 'hu-3bet';
 return limped&&raises===2?'hu-3bet':'hu-4bet';
}
const MW_SPOTS=new Set(['co-btn-bb','utg-btn-bb','btn-sb-bb']);
const POT_TYPE:Record<string,string[]>={srp:['btn-bb','co-bb','hj-bb','utg-bb','sb-bb','co-btn','utg-btn'],'3bet':['btn-bb-3bet','co-bb-3bet','utg-bb-3bet','btn-sb-3bet','co-btn-3bet'],'4bet':['btn-bb-4bet'],
 'co-btn-bb':['co-btn-bb','utg-btn-bb','btn-sb-bb'],'utg-btn-bb':['utg-btn-bb','co-btn-bb','btn-sb-bb'],'btn-sb-bb':['btn-sb-bb','co-btn-bb','utg-btn-bb'],
 'sb-limp':['sb-limp'],'sb-iso':['sb-iso'],'sb-limp-3bet':['sb-limp-3bet'],
 'hu-srp':['hu-srp','btn-bb'],'hu-limp':['hu-limp'],'hu-3bet':['hu-3bet','btn-bb-3bet'],'hu-4bet':['hu-4bet','btn-bb-4bet']};
function flopFile(data:GtoData,spot:string,flop:string):FlopData|null{
 const type=spot.startsWith('hu-')||spot.startsWith('sb-limp')||spot==='sb-iso'||MW_SPOTS.has(spot)?spot:Object.entries(POT_TYPE).find(([,l])=>l.includes(spot))?.[0]??'srp';
 for(const s of [spot,...POT_TYPE[type].filter(x=>x!==spot)]){
  const list=data.flopIndex[s];if(!list?.length)continue;
  const canon=canonicalFlop(flop),exact=list.find(f=>canonicalFlop(f)===canon);
  const pick=exact??nearestFlop(flop,list);const name=typeof pick==='string'?pick:(pick as {flop?:string}|null)?.flop;
  if(!name)continue;const d=data.flop(s,name);if(d)return d;
 }
 return null;
}
const sizeOf=(label:string)=>{const m=/([\d.]+)%/.exec(label);return m?Number(m[1])/100:null;};
function flopIndexOf(node:FlopNode,a:LoggedAction):number{
 const kinds=node.actions.map(x=>x.kind);
 if(a.type==='fold')return kinds.indexOf('fold');
 if(a.type==='check')return kinds.indexOf('check');
 if(a.type==='call')return kinds.indexOf('call');
 if(a.allIn&&kinds.includes('allin'))return kinds.indexOf('allin');
 if(a.type==='bet'){const frac=(a.to)/Math.max(1,a.potBefore);let best=-1,d=Infinity;node.actions.forEach((x,i)=>{const s=x.kind==='bet'?sizeOf(x.label):null;if(s!==null&&Math.abs(s-frac)<d){d=Math.abs(s-frac);best=i;}});return best>=0?best:kinds.indexOf('allin');}
 const r=kinds.indexOf('raise');return r>=0?r:kinds.indexOf('allin');
}

/** The flop row for one combo: the suit-aware row when the file has one ("AKs|21"), else the class row.
 * Suits are counted on the real flop. */
export function flopRow(node:FlopNode,a:number,b:number,board:readonly number[]):number[]|undefined{
 const cls=classOf(a,b);if(node.suits){const n=(c:number)=>board.filter(x=>(x&3)===(c&3)).length,x=n(a),y=n(b),row=node.suits[`${cls}|${x>=y?`${x}${y}`:`${y}${x}`}`];if(row)return row;}
 return node.classes[cls];
}
// ---------- turn/river solver cache ----------
type Solve={solver:PostflopSolver;board:number[];players:[string,string];bb:number;startPot:number};
const solves=new Map<string,Solve>();
// Each solve holds large strategy tables (tens to hundreds of MB): keep only the current hand's turn and river solves.
function remember(k:string,s:Solve){solves.set(k,s);while(solves.size>2)solves.delete(solves.keys().next().value as string);}
/** Drop cached turn/river solves (call when a hand ends, so memory does not pile up across hands). */
export function clearGtoSolves(){solves.clear();}
function runSolver(s:PostflopSolver,budgetMs:number){const t=Date.now(),step=budgetMs<1000?2:10;let n=0;while(Date.now()-t<budgetMs&&n<400){s.run(step);n+=step;if(n%80===0&&s.exploitability()<0.003)break;}}
/** Walk a solver tree along the logged actions (bb units); returns the node, its card context, or null when off the tree. */
function walk(s:Solve,acts:readonly LoggedAction[],river:number|null,startStreet:Street):{node:ActNode;ctx:number}|null{
 let node:Node=s.solver.tree,ctx=NO_CARDS;
 const streetOf=(n:ActNode)=>n.street;
 for(const a of acts){
  while(node.kind==='chance'){if(river===null)return null;ctx=dealCard(ctx,river);node=node.child;}
  if(node.kind!=='act')return null;
  if(streetOf(node)!==a.street)return null;
  const idx=solverIndex(node,a,s.bb);if(idx<0)return null;node=node.children[idx];
 }
 while(node.kind==='chance'){if(river===null)return null;ctx=dealCard(ctx,river);node=node.child;}
 return node.kind==='act'?{node,ctx}:null;
 void startStreet;
}
function solverIndex(node:ActNode,a:LoggedAction,bb:number):number{
 const kinds=node.actions.map(x=>x.kind);
 if(a.type==='fold')return kinds.indexOf('fold');if(a.type==='check')return kinds.indexOf('check');if(a.type==='call')return kinds.indexOf('call');
 if(a.allIn&&kinds.includes('allin'))return kinds.indexOf('allin');
 const to=a.to/bb;let best=-1,d=Infinity;node.actions.forEach((x,i)=>{if(x.kind!=='bet'&&x.kind!=='raise'&&x.kind!=='allin')return;const y=Math.abs(x.to-to);if(y<d){d=y;best=i;}});return best;
}

// ---------- main ----------
/** One option at the decision point; `to` is the street total in chips (null: from the label). */
export type GtoOption={kind:string;label:string;to:number|null};
/** The model's mixed strategy for the hero's hand at this decision. `indexOf` maps a played action onto an option (-1: none). */
/** The whole range at the hero's decision (2026/10/29: 振り返りでレンジ表全体を表示): per hand class, how often the hero
 * arrives here with it (0〜1, relative) and the action shares. */
export type GtoGrid=Record<string,{reach:number;freqs:number[]}>;
export type GtoStrategy={source:'preflop'|'flop'|'solver';options:GtoOption[];freqs:number[];indexOf(a:LoggedAction):number;grid?:GtoGrid;
 /** EV of each option for the hero's hand, in big blinds (preflop chart decisions only, when the EV file is loaded). */
 ev?:number[];
 /** Set when the flop data is for a nearby precomputed flop, not the real one. */
 nearFlop?:string;
 /** Set when another spot's flop data stands in (heads-up spots not computed yet). */
 proxySpot?:string;
 /** 近似値 (2026/10/30): a quick live solve instead of computed data — four or more players saw the flop, or this flop
  * spot is not computed yet. A guide, not graded. */
 approx?:boolean}|{source:'fallback';reason:string};
export function decideGto(v:GtoView,data:GtoData,random:()=>number=Math.random,budgetMs=5000):GtoDecision{
 const s=gtoStrategy(v,data,budgetMs);
 if(s.source==='fallback')return {action:fallback(v,random),source:'fallback',reason:s.reason};
 try{const o=s.options[sample(s.freqs,random)];return {action:toTable(v,o.kind,o.label,o.to),source:s.source};}
 catch(e){return {action:fallback(v,random),source:'fallback',reason:'error:'+(e instanceof Error?e.message:String(e)).slice(0,60)};}
}
/** rangeOnly (2026/10/29: 相手のアクションのレンジ表): no hole cards needed; freqs are zeros and only the grid is meaningful. */
export function gtoStrategy(v:GtoView,data:GtoData,budgetMs=5000,rangeOnly=false,opts:{noApprox?:boolean}={}):GtoStrategy{
 const fb=(reason='other'):GtoStrategy=>({source:'fallback',reason});
 try{
  const noHole=v.hole.length!==2;if(noHole&&!rangeOnly)return fb('no-cards');
  const me=v.players.find(p=>p.id===v.hero);if(!me)return fb('no-hero');
  const effective=Math.min(...Object.values(v.startStacks))/v.bb;
  // Charts: 100BB, and for 6-max 60/40/20BB (tournaments). Very short or very deep tables use the equity CPU.
  const hu=Object.keys(v.positions).length===2&&!!data.preflopHu;
  const depth=hu?100:depthChart(effective),depthData=depth===100?null:data.preflopDepths?.[depth];
  if(effective>250||(hu||!depthData)&&effective<40||effective<5)return fb('stack-depth');
  // Heads-up (only two dealt in): the heads-up chart and spots; the button (SB) acts last after the flop.
  if(hu)data={...data,preflop:data.preflopHu!};
  // Shorter stacks: that depth's chart. The flop files are 100BB: still used at 60BB (similar spots), not at 40/20BB.
  if(depthData)data={...data,preflop:depthData,...(depth<=40?{flopIndex:{},flop:()=>null}:{})};
  const toks=preflopToks(v,hu),ranges=trackPreflop(v,data,toks);
  if(v.board.length===0)return preflopStrategy(v,data,toks,noHole)??fb('preflop-off-chart');
  const live=v.players.filter(p=>!p.folded);
  // Three players saw the flop (2026/10/29): three-way flop data, then a live three-way solve or, after a fold, heads-up.
  const foldedPre=new Set(v.log.filter(a=>a.street==='preflop'&&a.type==='fold').map(a=>a.id)),preLive=v.players.filter(p=>!foldedPre.has(p.id));
  let multi:{spot:string;order:string[];file:FlopData|null}|null=null;
  // Four or more saw the flop (2026/10/30): no computed spots exist; a quick many-player solve gives a 近似値.
  if(!hu&&preLive.length>=4)return opts.noApprox?fb('multiway-4'):manyWayStrategy(v,toks,ranges,noHole,budgetMs);
  if(!hu&&preLive.length===3){
   // Off the chart (e.g. a limp, a complete and a check) or no computed three-way flop: the quick live solve (近似値).
   if(!ranges)return opts.noApprox?fb('preflop-off-chart'):manyWayStrategy(v,toks,null,noHole,budgetMs);
   const order=[...preLive].sort((a,b)=>POST_ORDER.indexOf(v.positions[a.id])-POST_ORDER.indexOf(v.positions[b.id])).map(p=>p.id);
   const spot3=multiSpotFor(v,toks),flopText3=v.board.slice(0,3).map(c=>'23456789TJQKA'[c.rank-2]+c.suit).join('');
   multi={spot:spot3,order,file:flopFile(data,spot3,flopText3)};
   if(!multi.file&&v.board.length===3&&!opts.noApprox)return manyWayStrategy(v,toks,ranges,noHole,budgetMs);
   const r=multiwayStrategy(v,multi,ranges,noHole,budgetMs,flopText3);if(r)return r;
  }
  if(live.length!==2)return fb('multiway');if(!ranges)return fb('preflop-off-chart');
  const order=hu?HU_POST_ORDER:POST_ORDER,pair=[...live].sort((a,b)=>order.indexOf(v.positions[a.id])-order.indexOf(v.positions[b.id])).map(p=>p.id) as [string,string];
  const spot=multi?multi.spot:hu?huSpotFor(toks):spotFor(v,toks,pair);if(!spot)return fb('no-spot');
  const flopActs=v.log.filter(a=>a.street==='flop');
  const flopText=v.board.slice(0,3).map(c=>'23456789TJQKA'[c.rank-2]+c.suit).join('');
  const file=multi?null:flopFile(data,spot,flopText);
  if(v.board.length===3&&multi)return fb('flop-off-tree');
  if(v.board.length===3){
   // No computed flop yet (2026/10/30): a quick live solve on the flop instead, shown as 近似値 and not graded.
   if(!file)return opts.noApprox?fb('no-flop-data'):manyWayStrategy(v,toks,ranges,noHole,budgetMs,hu?HU_POST_ORDER:POST_ORDER);
   let node:FlopNode|undefined=file.nodes[0];
   for(const a of flopActs){if(!node)break;const i=flopIndexOf(node,a);if(i<0)return fb('flop-off-tree');const next:number|null=node.children[i];node=next===null?undefined:file.nodes[next];}
   if(!node||node.player!==pair.indexOf(v.hero))return fb('flop-off-tree');
   const row=noHole?[0,...node.actions.map(()=>0)]:flopRow(node,code(v.hole[0]),code(v.hole[1]),v.board.slice(0,3).map(code));if(!row)return fb('flop-class-missing');
   const at=node;
   const grid:GtoGrid={};for(const [cls,r] of Object.entries(at.classes))grid[cls]={reach:r[0]/combosOf(cls),freqs:r.slice(1)};
   return {source:'flop',options:at.actions.map(x=>({kind:x.kind,label:x.label,to:null})),freqs:row.slice(1),indexOf:a=>flopIndexOf(at,a),grid:normalizeGrid(grid),nearFlop:canonicalFlop(file.flop)===canonicalFlop(flopText)?undefined:file.flop,proxySpot:file.spot.id&&file.spot.id!==spot?file.spot.id:undefined};
  }
  // Turn and river: narrow both ranges through the flop, then solve from the turn (reused on the river).
  if(file)trackFlop(file,flopActs,ranges,pair,v.board.slice(0,3).map(code));
  if(multi?.file)trackMultiFlop(multi.file,flopActs,ranges,multi.order);
  const board=v.board.map(code),turnKey=`${v.handKey}|${noHole?'':v.hero}|${board.slice(0,4).join(',')}`;
  let s=solves.get(turnKey);
  const turnActs=v.log.filter(a=>a.street==='turn'),riverActs=v.log.filter(a=>a.street==='river');
  const potAt=(street:Street)=>{const first=v.log.find(a=>a.street===street);return first?first.potBefore:potNow(v);};
  if(!s){
   if(v.board.length===4){s=solve(v,board.slice(0,4),ranges,pair,potAt('turn'),spot,budgetMs);remember(turnKey,s);}
  }
  let at=s&&walk(s,v.board.length===4?turnActs:[...turnActs,...riverActs],v.board.length===5?board[4]:null,'turn');
  if(!at&&v.board.length===5){
   // Off the turn tree (or no turn solve): narrow by the turn solve when possible, then solve the river alone.
   const riverKey=`${v.handKey}|${noHole?'':v.hero}|${board.join(',')}`;let r=solves.get(riverKey);
   if(!r){if(s)trackSolver(s,turnActs,null,ranges);r=solve(v,board,ranges,pair,potAt('river'),spot,Math.min(budgetMs,2000));remember(riverKey,r);}
   at=walk(r,riverActs,null,'river');s=r;
  }
  if(!at||!s)return fb('solver-off-tree');
  const player=at.node.player,side=s.solver.sides[player],h=noHole?undefined:side.keyIndex.get(key2(code(v.hole[0]),code(v.hole[1])));
  if(pair[player]!==v.hero||(!noHole&&h===undefined))return fb('solver-hero-missing');
  const st=s.solver.strategy(at.node,true,at.ctx),k=at.node.actions.length,node=at.node,bb=s.bb;
  // Per class: average over the combos still in the solve, weighted by the range at the start of the solve.
  const acc:Record<string,{w:number;f:number[]}>={};
  for(let i=0;i<side.n;i++){const w=side.w[i];if(!(w>0))continue;const cls=classOf(side.c1[i],side.c2[i]),e=acc[cls]??=({w:0,f:new Array(k).fill(0)});e.w+=w;for(let j=0;j<k;j++)e.f[j]+=w*st[i*k+j];}
  const grid:GtoGrid={};for(const [cls,e] of Object.entries(acc))grid[cls]={reach:e.w/combosOf(cls),freqs:e.f.map(x=>x/e.w)};
  return {source:'solver',options:node.actions.map(a=>({kind:a.kind,label:a.label,to:a.to*v.bb})),freqs:h===undefined?new Array(k).fill(0):Array.from(st.slice(h*k,h*k+k)),indexOf:a=>solverIndex(node,a,bb),grid:normalizeGrid(grid)};
 }catch(e){return fb('error:'+(e instanceof Error?e.message:String(e)).slice(0,60));}
}

// ---------- three-way pots (2026/10/29) ----------
/** Open, a call and the big blind's call: the computed three-way spot closest to this line. */
function multiSpotFor(v:GtoView,toks:Tok[]):string{
 const open=toks.find(t=>t.kind==='R')?.pos,caller=toks.find(t=>t.kind==='C'&&t.pos!=='BB')?.pos;
 if(caller==='SB')return 'btn-sb-bb';
 if(open==='UTG'||open==='HJ')return 'utg-btn-bb';
 void v;return 'co-btn-bb';
}
function multiIndexOf(node:{actions:{kind:string;label:string;to?:number}[]},a:LoggedAction,bb?:number):number{
 const kinds=node.actions.map(x=>x.kind);
 if(a.type==='fold')return kinds.indexOf('fold');if(a.type==='check')return kinds.indexOf('check');if(a.type==='call')return kinds.indexOf('call');
 if(a.allIn&&kinds.includes('allin'))return kinds.indexOf('allin');
 if(bb!==undefined){const to=a.to/bb;let best=-1,d=Infinity;node.actions.forEach((x,i)=>{if(x.kind!=='bet'&&x.kind!=='raise'&&x.kind!=='allin')return;const y=Math.abs((x.to??0)-to);if(y<d){d=y;best=i;}});return best;}
 return flopIndexOf(node as FlopNode,a);
}
function trackMultiFlop(file:FlopData,acts:readonly LoggedAction[],ranges:Ranges,order:string[]){
 let node:FlopNode|undefined=file.nodes[0];
 for(const a of acts){if(!node)return;const i=multiIndexOf(node,a);if(i<0)return;const w=ranges.get(order[node.player]),cur=node;
  if(w)scale(w,(x,y)=>{const row=cur.classes[classOf(x,y)];return row?row[1+i]:0;});
  const next:number|null=node.children[i];node=next===null?undefined:file.nodes[next];}
}
const multiSolves=new Map<string,{solver:MultiwaySolver;order:string[];bb:number}>();
function multiwayStrategy(v:GtoView,multi:{spot:string;order:string[];file:FlopData|null},ranges:Ranges,noHole:boolean,budgetMs:number,flopText:string):GtoStrategy|null{
 const fb=(reason:string):GtoStrategy=>({source:'fallback',reason}),hi=multi.order.indexOf(v.hero);
 const flopActs=v.log.filter(a=>a.street==='flop');
 if(v.board.length===3){
  if(!multi.file)return fb('no-flop-data');
  let node:FlopNode|undefined=multi.file.nodes[0];
  for(const a of flopActs){if(!node)break;const i=multiIndexOf(node,a);if(i<0)return fb('flop-off-tree');const next:number|null=node.children[i];node=next===null?undefined:multi.file.nodes[next];}
  if(!node||node.player!==hi)return fb('flop-off-tree');
  const at=node,row=noHole?[0,...at.actions.map(()=>0)]:at.classes[classOf(code(v.hole[0]),code(v.hole[1]))];if(!row)return fb('flop-class-missing');
  const grid:GtoGrid={};for(const [cls,r] of Object.entries(at.classes))grid[cls]={reach:r[0]/combosOf(cls),freqs:r.slice(1)};
  return {source:'flop',options:at.actions.map(x=>({kind:x.kind,label:x.label,to:null})),freqs:row.slice(1),indexOf:a=>multiIndexOf(at,a),grid:normalizeGrid(grid),
   nearFlop:canonicalFlop(multi.file.flop)===canonicalFlop(flopText)?undefined:multi.file.flop,proxySpot:multi.file.spot.id&&multi.file.spot.id!==multi.spot?multi.file.spot.id:undefined};
 }
 // Later streets: only while all three are still in (after a fold the heads-up path takes over).
 if(v.players.filter(p=>!p.folded).length!==3)return null;
 if(multi.file)trackMultiFlop(multi.file,flopActs,ranges,multi.order);
 const street:Street=v.board.length===4?'turn':'river',board=v.board.map(code),acts=v.log.filter(a=>a.street===street);
 const key=`${v.handKey}|mw|${noHole?'':v.hero}|${board.join(',')}`;let s=multiSolves.get(key);
 if(!s){
  const first=v.log.find(a=>a.street===street),pot=(first?first.potBefore:potNow(v))/v.bb;
  const combosOf3=(id:string)=>{const w=ranges.get(id)!,out:Combo[]=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){const x=w[a*52+b];if(x>1e-6&&!board.includes(a)&&!board.includes(b))out.push({c1:a,c2:b,weight:x});}return out;};
  const rs=multi.order.map(combosOf3) as [Combo[],Combo[],Combo[]];
  if(!noHole&&hi>=0){const hk=key2(code(v.hole[0]),code(v.hole[1]));if(!rs[hi].some(c=>key2(c.c1,c.c2)===hk))rs[hi].push({c1:code(v.hole[0]),c2:code(v.hole[1]),weight:1e-3});}
  const stacks=multi.order.map(id=>{const p=v.players.find(x=>x.id===id)!;return (v.startStacks[id]-p.totalCommitted+p.committed)/v.bb;});
  const solver=new MultiwaySolver({board,pot,stack:Math.max(0.5,Math.min(...stacks)),ranges:rs,betSizes:[0.5],raiseSizes:[3],maxRaises:1,allinMaxPot:1.5,depthLimit:true});
  const t=Date.now();while(Date.now()-t<budgetMs&&solver.iterations<200)solver.run(1);
  s={solver,order:multi.order,bb:v.bb};multiSolves.set(key,s);while(multiSolves.size>2)multiSolves.delete(multiSolves.keys().next().value as string);
 }
 let node:MNode=s.solver.tree;
 for(const a of acts){if(node.kind!=='act')return fb('solver-off-tree');const i=multiIndexOf(node,a,1);if(i<0)return fb('solver-off-tree');node=node.children[i];}
 if(node.kind!=='act'||node.player!==hi)return fb('solver-off-tree');
 const at:MActNode=node,side=s.solver.sides[hi],k=at.actions.length,st=s.solver.strategy(at,true);
 let h=-1;if(!noHole){const a=code(v.hole[0]),b=code(v.hole[1]);for(let i=0;i<side.n;i++)if((side.c1[i]===a&&side.c2[i]===b)||(side.c1[i]===b&&side.c2[i]===a)){h=i;break;}if(h<0)return fb('solver-hero-missing');}
 const acc:Record<string,{w:number;f:number[]}>={};
 for(let i=0;i<side.n;i++){const w=side.w[i];if(!(w>0))continue;const cls=classOf(side.c1[i],side.c2[i]),e=acc[cls]??=({w:0,f:new Array(k).fill(0)});e.w+=w;for(let j=0;j<k;j++)e.f[j]+=w*st[i*k+j];}
 const grid:GtoGrid={};for(const [cls,e] of Object.entries(acc))grid[cls]={reach:e.w/combosOf(cls),freqs:e.f.map(x=>x/e.w)};
 const bb=v.bb;
 return {source:'solver',options:at.actions.map(a=>({kind:a.kind,label:a.label,to:a.to*bb})),freqs:h<0?new Array(k).fill(0):Array.from(st.slice(h*k,h*k+k)),indexOf:a=>multiIndexOf(at,a,bb),grid:normalizeGrid(grid)};
}
// ---------- four or more players (2026/10/30, 近似値) ----------
/** Hand classes strongest first (equity against a random hand), for estimated ranges. */
const RANK_ORDER:string[]=(rankData as {order:string[]}).order;
/** Top `share` of all combos by class order, as a 52×52 weight table. */
function topRange(share:number):Float64Array{
 const w=new Float64Array(2704),keep=new Set<string>();let n=0;
 for(const cls of RANK_ORDER){if(n>=share*1326)break;keep.add(cls);n+=combosOf(cls);}
 for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)if(keep.has(classOf(a,b)))w[a*52+b]=1;
 return w;
}
/** Each player's range from their own preflop actions when the chart has no answer: raisers tight, callers wider,
 * limpers wide, the big blind's check any two cards. A rough guide (shown as 近似値). */
function estimatedRanges(v:GtoView,toks:Tok[]):Ranges{
 const out:Ranges=new Map();let raises=0;const role=new Map<Pos,string>();
 for(const t of toks){if(t.kind==='R'){raises++;role.set(t.pos,raises>=2?'reraise':'open');}else if(t.kind==='C'&&role.get(t.pos)!=='open'&&role.get(t.pos)!=='reraise')role.set(t.pos,raises===0?(t.pos==='SB'?'complete':t.pos==='BB'?'check':'limp'):'call');}
 const share:Record<string,number>={reraise:0.05,open:0.15,call:0.22,limp:0.45,complete:0.6,check:1};
 for(const [id,pos] of Object.entries(v.positions)){const r=role.get(pos)??(pos==='BB'?'check':'limp');out.set(id,topRange(share[r]));}
 return out;
}
const nSolves=new Map<string,{solver:NWaySolver;order:string[]}>();
function nIndexOf(node:{actions:{kind:string;to:number}[]},a:LoggedAction,bb:number):number{
 const kinds=node.actions.map(x=>x.kind);
 if(a.type==='fold')return kinds.indexOf('fold');if(a.type==='check')return kinds.indexOf('check');if(a.type==='call')return kinds.indexOf('call');
 if(a.allIn&&kinds.includes('allin'))return kinds.indexOf('allin');
 const to=a.to/bb;let best=-1,d=Infinity;node.actions.forEach((x,i)=>{if(x.kind!=='bet'&&x.kind!=='raise'&&x.kind!=='allin')return;const y=Math.abs(x.to-to);if(y<d){d=y;best=i;}});return best;
}
function manyWayStrategy(v:GtoView,toks:Tok[],chartRanges:Ranges|null,noHole:boolean,budgetMs:number,postOrder:Pos[]=POST_ORDER):GtoStrategy{
 const fb=(reason:string):GtoStrategy=>({source:'fallback',reason});
 const live=v.players.filter(p=>!p.folded);if(live.length<2)return fb('multiway-4');
 const order=[...live].sort((a,b)=>postOrder.indexOf(v.positions[a.id])-postOrder.indexOf(v.positions[b.id])).map(p=>p.id),hi=order.indexOf(v.hero);
 if(hi<0)return fb('no-hero');
 const ranges=chartRanges??estimatedRanges(v,toks);
 const street:Street=v.board.length===3?'flop':v.board.length===4?'turn':'river',board=v.board.map(code),acts=v.log.filter(a=>a.street===street);
 const key=`${v.handKey}|nw|${noHole?'':v.hero}|${board.join(',')}|${order.join(',')}`;let s=nSolves.get(key);
 if(!s){
  const first=v.log.find(a=>a.street===street),pot=(first?first.potBefore:potNow(v))/v.bb;
  const combos=(id:string)=>{const w=ranges.get(id)??fullRange(),out:Combo[]=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){const x=w[a*52+b];if(x>1e-6&&!board.includes(a)&&!board.includes(b))out.push({c1:a,c2:b,weight:x});}return out;};
  const rs=order.map(combos);
  if(!noHole){const hk=key2(code(v.hole[0]),code(v.hole[1]));if(!rs[hi].some(c=>key2(c.c1,c.c2)===hk))rs[hi].push({c1:code(v.hole[0]),c2:code(v.hole[1]),weight:1e-3});
   // keep the hero's own combo even when the range is trimmed to its heaviest combos
   const mine=rs[hi].find(c=>key2(c.c1,c.c2)===hk)!;mine.weight=Math.max(...rs[hi].map(c=>c.weight))*1.000001;}
  const stacks=order.map(id=>{const p=v.players.find(x=>x.id===id)!;return (v.startStacks[id]-p.totalCommitted+p.committed)/v.bb;});
  const solver=new NWaySolver({board,pot,stack:Math.max(0.5,Math.min(...stacks)),ranges:rs,betSizes:[0.5],raiseSizes:[3],maxRaises:order.length>=5?0:1,allinMaxPot:1.5});
  const t=Date.now();while(Date.now()-t<budgetMs&&solver.iterations<300)solver.run(1);if(!solver.iterations)solver.run(1);
  s={solver,order};nSolves.set(key,s);while(nSolves.size>2)nSolves.delete(nSolves.keys().next().value as string);
 }
 let node:NNode=s.solver.tree;
 for(const a of acts){if(node.kind!=='act')return fb('solver-off-tree');const i=nIndexOf(node,a,v.bb);if(i<0)return fb('solver-off-tree');node=node.children[i];}
 if(node.kind!=='act'||node.player!==hi)return fb('solver-off-tree');
 const at:NActNode=node,side=s.solver.sides[hi],k=at.actions.length,st=s.solver.strategy(at,true);
 let h=-1;if(!noHole){const a=code(v.hole[0]),b=code(v.hole[1]);for(let i=0;i<side.n;i++)if((side.c1[i]===a&&side.c2[i]===b)||(side.c1[i]===b&&side.c2[i]===a)){h=i;break;}if(h<0)return fb('solver-hero-missing');}
 const acc:Record<string,{w:number;f:number[]}>={};
 for(let i=0;i<side.n;i++){const w=side.w[i];if(!(w>0))continue;const cls=classOf(side.c1[i],side.c2[i]),e=acc[cls]??=({w:0,f:new Array(k).fill(0)});e.w+=w;for(let j=0;j<k;j++)e.f[j]+=w*st[i*k+j];}
 const grid:GtoGrid={};for(const [cls,e] of Object.entries(acc))grid[cls]={reach:e.w/combosOf(cls),freqs:e.f.map(x=>x/e.w)};
 const bb=v.bb;
 return {source:'solver',approx:true,options:at.actions.map(a=>({kind:a.kind,label:a.label,to:a.to*bb})),freqs:h<0?new Array(k).fill(0):Array.from(st.slice(h*k,h*k+k)),indexOf:a=>nIndexOf(at,a,bb),grid:normalizeGrid(grid)};
}
function potNow(v:GtoView){return v.players.reduce((s,p)=>s+p.totalCommitted,0);}
function sample(p:number[],random:()=>number){const t=p.reduce((s,x)=>s+Math.max(0,x),0);if(!(t>0))return 0;let r=random()*t;for(let i=0;i<p.length;i++){r-=Math.max(0,p[i]);if(r<=0)return i;}return p.length-1;}

/** The chart node for `pos` after `toks`. Off the chart (extra cold callers), callers in front count as folds, as the
 * model has them; `noCall` then means a call would make the pot multiway (only the BB may overcall). `fold` = the model folds here. */
function nodeFor(data:GtoData,toks:readonly Tok[],pos:Pos):{node:PreflopNode;noCall:boolean}|'fold'|null{
 const m=chart(data.preflop),exact=m.get(keyOf(toks,pos));if(exact)return {node:exact,noCall:false};
 const mine=toks.some(t=>t.pos===pos&&t.kind!=='F'),raises=toks.filter(t=>t.kind==='R').length;
 const cold=toks.map(t=>t.kind==='C'&&t.pos!==pos?{...t,kind:'F' as const}:t),n=m.get(keyOf(cold,pos));
 if(n)return {node:n,noCall:pos!=='BB'};
 const opener=toks.find(t=>t.kind==='R')?.pos,lastRaiser=[...toks].reverse().find(t=>t.kind==='R')?.pos;
 if(raises>=2&&pos!==opener&&pos!==lastRaiser)return 'fold';
 void mine;
 return null;
}
function preflopStrategy(v:GtoView,data:GtoData,toks:Tok[],noHole=false):GtoStrategy|null{
 const found=nodeFor(data,toks,v.positions[v.hero]);if(!found)return null;
 if(found==='fold')return {source:'preflop',options:[{kind:'fold',label:'',to:null}],freqs:[1],indexOf:a=>a.type==='fold'||a.type==='check'?0:-1};
 const node=found.node,row0=noHole?node.actions.map(()=>0):node.strategy[classOf(code(v.hole[0]),code(v.hole[1]))];if(!row0)return null;
 const row=found.noCall?row0.map((p,i)=>node.actions[i].kind==='call'?0:node.actions[i].kind==='fold'?p+(row0[node.actions.findIndex(a=>a.kind==='call')]??0):p):row0;
 const pos=v.positions[v.hero],evRow=!noHole&&!found.noCall?data.preflopEv?.[node.id]?.[classOf(code(v.hole[0]),code(v.hole[1]))]:undefined;
 return {source:'preflop',options:node.actions.map(a=>({kind:a.kind,label:'',to:a.kind==='allin'?Infinity:(a.to??0)*v.bb})),freqs:[...row],...(evRow&&evRow.length===node.actions.length?{ev:[...evRow]}:{}),
  indexOf:a=>chartIndex(node,{pos,kind:a.type==='fold'?'F':a.type==='call'||a.type==='check'?'C':'R',to:a.allIn&&node.actions.some(x=>x.kind==='allin')?100:a.to/v.bb}),
  grid:preflopGrid(data.preflop,node,found.noCall)};
}
/** Combos per hand class before card removal (reach is per combo, so pairs and offsuit hands compare fairly). */
const combosOf=(cls:string)=>cls.length===2?6:cls[2]==='s'?4:12;
/** Reach scaled so the most frequent class is 1 (cells are dimmed by it). */
function normalizeGrid(g:GtoGrid):GtoGrid{const m=Math.max(0,...Object.values(g).map(x=>x.reach));if(!(m>0))return g;for(const x of Object.values(g))x.reach/=m;return g;}
function preflopGrid(data:PreflopData,node:PreflopNode,noCall:boolean):GtoGrid{
 const reach=preflopReach(data,node),call=node.actions.findIndex(a=>a.kind==='call'),fold=node.actions.findIndex(a=>a.kind==='fold'),grid:GtoGrid={};
 for(const [cls,row] of Object.entries(node.strategy)){
  const freqs=noCall&&call>=0&&fold>=0?row.map((p,i)=>i===call?0:i===fold?p+row[call]:p):[...row];
  grid[cls]={reach:reach[cls]??1,freqs};
 }
 return normalizeGrid(grid);
}
/** Each player's range after their preflop actions (null when the hand left the chart). */
function trackPreflop(v:GtoView,data:GtoData,toks:Tok[]):Ranges|null{
 const ranges:Ranges=new Map(Object.keys(v.positions).map(id=>[id,fullRange()]));
 const idOf=new Map(Object.entries(v.positions).map(([id,p])=>[p,id]));
 for(let i=0;i<toks.length;i++){
  const t=toks[i],found=nodeFor(data,toks.slice(0,i),t.pos),node=found&&found!=='fold'?found.node:null;
  if(!node){if(t.kind==='F')continue;return null;}
  const j=chartIndex(node,t);if(j<0)return null;const w=ranges.get(idOf.get(t.pos)!);if(!w)continue;
  scale(w,(a,b)=>node.strategy[classOf(a,b)]?.[j]??0);
 }
 return ranges;
}
function trackFlop(file:FlopData,acts:readonly LoggedAction[],ranges:Ranges,pair:[string,string],board:readonly number[]){
 let node:FlopNode|undefined=file.nodes[0];
 for(const a of acts){if(!node)return;const i=flopIndexOf(node,a);if(i<0)return;const w=ranges.get(pair[node.player]),cur=node;
  if(w)scale(w,(x,y)=>{const row=flopRow(cur,x,y,board);return row?row[1+i]:cur.total[i]??1;});
  const next:number|null=node.children[i];node=next===null?undefined:file.nodes[next];}
}
function trackSolver(s:Solve,acts:readonly LoggedAction[],river:number|null,ranges:Ranges){
 let node:Node=s.solver.tree,ctx=NO_CARDS;
 for(const a of acts){
  while(node.kind==='chance'){if(river===null)return;ctx=dealCard(ctx,river);node=node.child;}
  if(node.kind!=='act')return;const i=solverIndex(node,a,s.bb);if(i<0)return;
  const side=s.solver.sides[node.player],st=s.solver.strategy(node,true,ctx),k=node.actions.length,w=ranges.get(s.players[node.player]);
  if(w)scale(w,(x,y)=>{const h=side.keyIndex.get(x*52+y);return h===undefined?0:st[h*k+i];});
  node=node.children[i];
 }
}
function solve(v:GtoView,board:number[],ranges:Ranges,pair:[string,string],potChips:number,spot:string,budgetMs:number):Solve{
 const combos=(id:string)=>{const w=ranges.get(id)!,out:Combo[]=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){const x=w[a*52+b];if(x>1e-6&&!board.includes(a)&&!board.includes(b))out.push({c1:a,c2:b,weight:x});}return out;};
 // The hero's real combo must exist in its own range for the solver to give it a strategy.
 const heroIdx=pair.indexOf(v.hero),rs:[Combo[],Combo[]]=[combos(pair[0]),combos(pair[1])],hk=v.hole.length===2?key2(code(v.hole[0]),code(v.hole[1])):-1;
 if(heroIdx>=0&&hk>=0&&!rs[heroIdx].some(c=>key2(c.c1,c.c2)===hk))rs[heroIdx].push({c1:code(v.hole[0]),c2:code(v.hole[1]),weight:1e-3});
 const stacks=pair.map(id=>{const p=v.players.find(x=>x.id===id)!;return (v.startStacks[id]-p.totalCommitted+p.committed)/v.bb;});
 const deep=spot.endsWith('4bet')?{betSizes:[0.5],river:[0.75]}:{betSizes:[0.33,0.75],river:[0.5,1]};
 const solver=new PostflopSolver({board,pot:potChips/v.bb,stack:Math.max(0.5,Math.min(...stacks)),ranges:rs,
  betSizes:board.length===4?deep.betSizes:deep.river,raiseSizes:[3],maxRaises:1,riverBetSizes:deep.river,riverRaiseSizes:[3],riverMaxRaises:1,allinMaxPot:1.5});
 runSolver(solver,budgetMs);
 return {solver,board,players:pair,bb:v.bb,startPot:potChips};
}

/** Convert a chosen action to a legal table action. `to` is the street total in chips (null: from the label). */
export function toTable(v:GtoView,kind:string,label:string,to:number|null):BettingAction{
 const L=v.legal,me=v.players.find(p=>p.id===v.hero)!;
 if(kind==='fold')return L.check?{type:'check'}:{type:'fold'};
 if(kind==='check'||kind==='call')return L.callAmount>0&&L.call?{type:'call'}:L.check?{type:'check'}:{type:'call'};
 if(!L.raise||L.minRaiseTo===null||L.maxRaiseTo===null)return L.call&&L.callAmount>0?{type:'call'}:{type:'check'};
 const currentBet=Math.max(0,...v.players.map(p=>p.committed));
 let amount=to;
 if(amount===null){
  const frac=sizeOf(label),mult=/([\d.]+)倍/.exec(label);
  if(kind==='allin')amount=L.maxRaiseTo;
  else if(frac!==null)amount=Math.round(frac*potNow(v));
  else if(mult)amount=Math.round(me.committed+Number(mult[1])*(currentBet-me.committed));
  else amount=L.minRaiseTo;
 }
 if(kind==='allin'||!Number.isFinite(amount))amount=L.maxRaiseTo;
 amount=Math.min(L.maxRaiseTo,Math.max(L.minRaiseTo,Math.round(amount)));
 return {type:currentBet===0?'bet':'raise',amount};
}
function fallback(v:GtoView,random:()=>number):BettingAction{
 const me=v.players.find(p=>p.id===v.hero)!,others=v.players.filter(p=>p.id!==v.hero&&!p.folded),currentBet=Math.max(0,...v.players.map(p=>p.committed));
 return decideCpuAction({hole:v.hole,board:v.board,pot:potNow(v),toCall:v.legal.callAmount,stack:me.stack,committed:me.committed,currentBet,bigBlind:v.bb,legal:v.legal,
  opponents:others.length,playersBehind:others.filter(p=>!p.allIn).length,isBigBlind:v.positions[v.hero]==='BB',maxOpponentStack:Math.max(0,...others.map(p=>p.stack+p.committed))},EXPERT,random);
}

/** BTN/SB/BB then UTG→CO for the rest, clockwise from the button (heads-up: the button is SB). */
export function positionsFor(order:readonly string[],pos:{button:string;sb:string|null;bb:string}):Record<string,Pos>{
 const start=(order.indexOf(pos.button)+1)%order.length,clock=[...order.slice(start),...order.slice(0,start)];
 const out:Record<string,Pos>={};
 if(order.length===2){out[pos.button]='SB';out[pos.bb]='BB';return out;}
 const rest=clock.filter(id=>id!==pos.button&&id!==pos.sb&&id!==pos.bb),names=([[],['CO'],['HJ','CO'],['UTG','HJ','CO']] as Pos[][])[rest.length]??[];
 rest.forEach((id,i)=>{out[id]=names[i]??'UTG';});out[pos.button]='BTN';if(pos.sb)out[pos.sb]='SB';out[pos.bb]='BB';return out;
}

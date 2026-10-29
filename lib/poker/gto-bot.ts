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
import {classOf} from './solver-view';
import {canonicalFlop,nearestFlop} from './flop-subset';
import type {FlopData,FlopNode} from './gto-spots';

export type Pos='UTG'|'HJ'|'CO'|'BTN'|'SB'|'BB';
export type Street='preflop'|'flop'|'turn'|'river';
/** One voluntary action. `to` is the actor's total committed on that street after the action (chips). */
export type LoggedAction={street:Street;id:string;type:'fold'|'check'|'call'|'bet'|'raise';to:number;allIn:boolean;potBefore:number;currentBetBefore:number;committedBefore:number};
export type PreflopNode={id:number;player:Pos;history:string;kind:string;actions:{kind:string;to?:number}[];strategy:Record<string,number[]>};
export type PreflopData={nodes:PreflopNode[]};
export type GtoData={preflop:PreflopData;flopIndex:Record<string,string[]>;flop(spot:string,flop:string):FlopData|null};
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
const POST_ORDER:Pos[]=['SB','BB','UTG','HJ','CO','BTN'];
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
function preflopToks(v:GtoView):Tok[]{
 // Seats missing at a short-handed table count as folds in front of the action, as the 6-max chart expects.
 const present=new Set(Object.values(v.positions)),missing=(['UTG','HJ','CO','BTN'] as Pos[]).filter(p=>!present.has(p)).map(pos=>({pos,kind:'F' as const,to:0}));
 return [...missing,...v.log.filter(a=>a.street==='preflop').map(a=>({pos:v.positions[a.id],kind:(a.type==='fold'?'F':a.type==='call'||a.type==='check'?'C':'R') as Tok['kind'],to:a.to/v.bb}))];
}
/** Index of the chart action that best matches what was done. */
function chartIndex(node:PreflopNode,t:Tok):number{
 if(t.kind==='F')return node.actions.findIndex(a=>a.kind==='fold');
 if(t.kind==='C')return node.actions.findIndex(a=>a.kind==='call');
 let best=-1,d=Infinity;node.actions.forEach((a,i)=>{if(a.kind!=='raise'&&a.kind!=='allin')return;const x=Math.abs((a.to??100)-t.to);if(x<d){d=x;best=i;}});return best;
}

// ---------- ranges (2704 slots, a*52+b with a<b) ----------
type Ranges=Map<string,Float64Array>;
function fullRange(){const w=new Float64Array(2704);for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)w[a*52+b]=1;return w;}
function scale(w:Float64Array,f:(a:number,b:number)=>number){for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){const k=a*52+b;if(w[k]>0)w[k]*=f(a,b);}}

// ---------- spots ----------
function spotFor(v:GtoView,toks:Tok[],pair:[string,string]):string|null{
 const raises=toks.filter(t=>t.kind==='R'),open=raises[0]?.pos,low=(p:string)=>p.toLowerCase();
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
const POT_TYPE:Record<string,string[]>={srp:['btn-bb','co-bb','hj-bb','utg-bb','sb-bb','co-btn','utg-btn'],'3bet':['btn-bb-3bet','co-bb-3bet','utg-bb-3bet','btn-sb-3bet','co-btn-3bet'],'4bet':['btn-bb-4bet']};
function flopFile(data:GtoData,spot:string,flop:string):FlopData|null{
 const type=Object.entries(POT_TYPE).find(([,l])=>l.includes(spot))?.[0]??'srp';
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
function flopRow(node:FlopNode,a:number,b:number,board:readonly number[]):number[]|undefined{
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
export type GtoStrategy={source:'preflop'|'flop'|'solver';options:GtoOption[];freqs:number[];indexOf(a:LoggedAction):number}|{source:'fallback';reason:string};
export function decideGto(v:GtoView,data:GtoData,random:()=>number=Math.random,budgetMs=5000):GtoDecision{
 const s=gtoStrategy(v,data,budgetMs);
 if(s.source==='fallback')return {action:fallback(v,random),source:'fallback',reason:s.reason};
 try{const o=s.options[sample(s.freqs,random)];return {action:toTable(v,o.kind,o.label,o.to),source:s.source};}
 catch(e){return {action:fallback(v,random),source:'fallback',reason:'error:'+(e instanceof Error?e.message:String(e)).slice(0,60)};}
}
export function gtoStrategy(v:GtoView,data:GtoData,budgetMs=5000):GtoStrategy{
 const fb=(reason='other'):GtoStrategy=>({source:'fallback',reason});
 try{
  if(v.hole.length!==2)return fb('no-cards');
  const me=v.players.find(p=>p.id===v.hero);if(!me)return fb('no-hero');
  const effective=Math.min(...Object.values(v.startStacks))/v.bb;
  // The chart is solved for 100BB; very short or very deep tables use the equity CPU (push/fold when short).
  if(effective<40||effective>250)return fb('stack-depth');
  const toks=preflopToks(v),ranges=trackPreflop(v,data,toks);
  if(v.board.length===0)return preflopStrategy(v,data,toks)??fb('preflop-off-chart');
  const live=v.players.filter(p=>!p.folded);if(live.length!==2)return fb('multiway');if(!ranges)return fb('preflop-off-chart');
  const pair=[...live].sort((a,b)=>POST_ORDER.indexOf(v.positions[a.id])-POST_ORDER.indexOf(v.positions[b.id])).map(p=>p.id) as [string,string];
  const spot=spotFor(v,toks,pair);if(!spot)return fb('no-spot');
  const flopActs=v.log.filter(a=>a.street==='flop');
  const flopText=v.board.slice(0,3).map(c=>'23456789TJQKA'[c.rank-2]+c.suit).join('');
  const file=flopFile(data,spot,flopText);
  if(v.board.length===3){
   if(!file)return fb('no-flop-data');
   let node:FlopNode|undefined=file.nodes[0];
   for(const a of flopActs){if(!node)break;const i=flopIndexOf(node,a);if(i<0)return fb('flop-off-tree');const next:number|null=node.children[i];node=next===null?undefined:file.nodes[next];}
   if(!node||node.player!==pair.indexOf(v.hero))return fb('flop-off-tree');
   const row=flopRow(node,code(v.hole[0]),code(v.hole[1]),v.board.slice(0,3).map(code));if(!row)return fb('flop-class-missing');
   const at=node;
   return {source:'flop',options:at.actions.map(x=>({kind:x.kind,label:x.label,to:null})),freqs:row.slice(1),indexOf:a=>flopIndexOf(at,a)};
  }
  // Turn and river: narrow both ranges through the flop, then solve from the turn (reused on the river).
  if(file)trackFlop(file,flopActs,ranges,pair,v.board.slice(0,3).map(code));
  const board=v.board.map(code),turnKey=`${v.handKey}|${board.slice(0,4).join(',')}`;
  let s=solves.get(turnKey);
  const turnActs=v.log.filter(a=>a.street==='turn'),riverActs=v.log.filter(a=>a.street==='river');
  const potAt=(street:Street)=>{const first=v.log.find(a=>a.street===street);return first?first.potBefore:potNow(v);};
  if(!s){
   if(v.board.length===4){s=solve(v,board.slice(0,4),ranges,pair,potAt('turn'),spot,budgetMs);remember(turnKey,s);}
  }
  let at=s&&walk(s,v.board.length===4?turnActs:[...turnActs,...riverActs],v.board.length===5?board[4]:null,'turn');
  if(!at&&v.board.length===5){
   // Off the turn tree (or no turn solve): narrow by the turn solve when possible, then solve the river alone.
   const riverKey=`${v.handKey}|${board.join(',')}`;let r=solves.get(riverKey);
   if(!r){if(s)trackSolver(s,turnActs,null,ranges);r=solve(v,board,ranges,pair,potAt('river'),spot,Math.min(budgetMs,2000));remember(riverKey,r);}
   at=walk(r,riverActs,null,'river');s=r;
  }
  if(!at||!s)return fb('solver-off-tree');
  const player=at.node.player,side=s.solver.sides[player],h=side.keyIndex.get(key2(code(v.hole[0]),code(v.hole[1])));
  if(pair[player]!==v.hero||h===undefined)return fb('solver-hero-missing');
  const st=s.solver.strategy(at.node,true,at.ctx),k=at.node.actions.length,node=at.node,bb=s.bb;
  return {source:'solver',options:node.actions.map(a=>({kind:a.kind,label:a.label,to:a.to*v.bb})),freqs:Array.from(st.slice(h*k,h*k+k)),indexOf:a=>solverIndex(node,a,bb)};
 }catch(e){return fb('error:'+(e instanceof Error?e.message:String(e)).slice(0,60));}
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
function preflopStrategy(v:GtoView,data:GtoData,toks:Tok[]):GtoStrategy|null{
 const found=nodeFor(data,toks,v.positions[v.hero]);if(!found)return null;
 if(found==='fold')return {source:'preflop',options:[{kind:'fold',label:'',to:null}],freqs:[1],indexOf:a=>a.type==='fold'||a.type==='check'?0:-1};
 const node=found.node,cls=classOf(code(v.hole[0]),code(v.hole[1])),row0=node.strategy[cls];if(!row0)return null;
 const row=found.noCall?row0.map((p,i)=>node.actions[i].kind==='call'?0:node.actions[i].kind==='fold'?p+(row0[node.actions.findIndex(a=>a.kind==='call')]??0):p):row0;
 const pos=v.positions[v.hero];
 return {source:'preflop',options:node.actions.map(a=>({kind:a.kind,label:'',to:a.kind==='allin'?Infinity:(a.to??0)*v.bb})),freqs:[...row],
  indexOf:a=>chartIndex(node,{pos,kind:a.type==='fold'?'F':a.type==='call'||a.type==='check'?'C':'R',to:a.allIn&&node.actions.some(x=>x.kind==='allin')?100:a.to/v.bb})};
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
 const heroIdx=pair.indexOf(v.hero),rs:[Combo[],Combo[]]=[combos(pair[0]),combos(pair[1])],hk=key2(code(v.hole[0]),code(v.hole[1]));
 if(heroIdx>=0&&!rs[heroIdx].some(c=>key2(c.c1,c.c2)===hk))rs[heroIdx].push({c1:code(v.hole[0]),c2:code(v.hole[1]),weight:1e-3});
 const stacks=pair.map(id=>{const p=v.players.find(x=>x.id===id)!;return (v.startStacks[id]-p.totalCommitted+p.committed)/v.bb;});
 const deep=spot.endsWith('4bet')?{betSizes:[0.5],river:[0.75]}:{betSizes:[0.33,0.75],river:[0.5,1]};
 const solver=new PostflopSolver({board,pot:potChips/v.bb,stack:Math.max(0.5,Math.min(...stacks)),ranges:rs,
  betSizes:board.length===4?deep.betSizes:deep.river,raiseSizes:[3],maxRaises:1,riverBetSizes:deep.river,riverRaiseSizes:[3],riverMaxRaises:1,allinMaxPot:1.5});
 runSolver(solver,budgetMs);
 return {solver,board,players:pair,bb:v.bb,startPot:potChips};
}

/** Convert a chosen action to a legal table action. `to` is the street total in chips (null: from the label). */
function toTable(v:GtoView,kind:string,label:string,to:number|null):BettingAction{
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

/** 6-max preflop solver (100BB, no ante, no rake) — simplified model (2026/10/27).
 *
 * Model (stated on the page too):
 * - Action tree: fold / open (2.5BB, SB 3BB) / call / 3-bet / 4-bet / 5-bet all-in. Only the small blind may limp (folded
 *   to it, 2026/10/29); the big blind then checks or raises to 4BB, the SB folds, calls or 3-bets to 12BB, then all-in.
 * - After an open and a call, later players may squeeze (10BB, 12BB from the blinds; 2026/10/29); the opener folds, calls
 *   or moves all in, then the caller folds or calls. Only the big blind may call an open and a call (three-way).
 *   No cold 4-bets.
 * - Postflop is not played out: a called pot is worth (pot × share). The share is the preflop all-in equity of the two
 *   hand classes, adjusted for how well each side realises it (in position realises more; deeper pots differ more).
 * - Hands are the 169 starting-hand classes. Card removal is counted between the two players who reach a showdown;
 *   other players' ranges are treated as independent.
 * Solved with Discounted CFR (alpha 1.5, beta 0, gamma 2), all six players updated each iteration.
 */
export type PreflopAction={label:string;kind:'fold'|'call'|'raise'|'allin'|'check';to?:number};
export type PreflopDecision={type:'decision';id:number;player:number;history:string;facing:number;actions:PreflopAction[];children:PreflopNode[]};
export type PreflopTerminal={type:'terminal';invested:number[];winner?:number;showdown?:{a:number;b:number;kind:'limp'|'srp'|'3bp'|'4bp'|'allin';aggr?:number};threeWay?:[number,number,number]};
export type PreflopNode=PreflopDecision|PreflopTerminal;
export const POSITIONS=['UTG','HJ','CO','BTN','SB','BB'] as const;
/** Seat names for 6, 8 and 9 players (owner 2026/11/1: 大会・リングは8〜9人卓が基本). */
export function positionsFor(seats:number):readonly string[]{
 if(seats===9)return ['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'];
 if(seats===8)return ['UTG','UTG+1','LJ','HJ','CO','BTN','SB','BB'];
 return POSITIONS;
}
/** Postflop order (0 = first to act): SB, BB, then UTG … BTN last. */
const postOrder=(seats:number)=>Array.from({length:seats},(_,p)=>p>=seats-2?p-(seats-2):p+2);
/** Out-of-position realisation by pot kind and role (in position = 1.0), calibrated from the flop solutions
 * (scripts/poker-gto/calibrate-realize.cjs, 2026/10/29): the preflop aggressor out of position realises far more than
 * a caller out of position. 4-bet pots with the aggressor out of position and limped pots have no flop data yet. */
// Calibration from the current flop data (scripts/poker-gto/calibrate-realize.cjs, 2026/10/29) gave srp call 0.675 /
// aggr 1.02, 3bp aggr 1.167 / call 0.61, 4bp call 0.553, but the re-solved chart then folded the big blind too much and
// opened the button too little against published solver results: the flop trees give the player out of position too few
// options, so the caller's share comes out low. Until the flop trees are widened and re-solved (and the preflop values
// come from per-hand flop EVs), both roles keep the earlier factors, so the chart is unchanged.
export const REALIZE_ROLE:Record<'srp'|'3bp'|'4bp',{call:number;aggr:number}>={srp:{call:0.8,aggr:0.8},'3bp':{call:0.88,aggr:0.88},'4bp':{call:0.95,aggr:0.95}};
export const REALIZE:Record<'limp'|'srp'|'3bp'|'4bp'|'allin',[number,number]>={limp:[0.85,1.0],srp:[0.8,1.0],'3bp':[0.88,1.0],'4bp':[0.95,1.0],allin:[1,1]};// [out of position, in position]
/** How well a class plays after the flop (suited and connected hands realise more equity, disconnected offsuit less). */
export let PLAYABILITY={suited:0.06,offsuit:-0.06,gapStep:0.02,pair:0.02};
/** Per-class playability fitted from the per-hand flop EVs (scripts/poker-gto/calibrate-hands.cjs), when loaded. */
let PLAY_TABLE:Record<string,number>|null=null;
/** Per stack depth (2026/11/1, tournament charts fitted to published 8-handed BBA ranges): a playability table and
 * realisation roles for that depth, used as they are (no scaling towards 1 by depth). Keyed by the stack in BB. */
type StackFit={play?:Record<string,number>;role?:Partial<typeof REALIZE_ROLE>};
let BY_STACK:Record<string,StackFit>|null=null;
/** Load a realisation fit ({role, play}) before solving (2026/10/29). Classes missing from `play` keep the formula. */
export function setRealizeFit(fit:{role?:Partial<typeof REALIZE_ROLE>;play?:Record<string,number>;byStack?:Record<string,StackFit>}|null){
 PLAY_TABLE=fit?.play??null;BY_STACK=fit?.byStack??null;for(const [k,v] of Object.entries(fit?.role??{}))if(v)REALIZE_ROLE[k as keyof typeof REALIZE_ROLE]={...v};
}
export function playability(label:string){
 if(PLAY_TABLE&&PLAY_TABLE[label]!==undefined)return PLAY_TABLE[label];
 const r='23456789TJQKA',a=r.indexOf(label[0]),b=r.indexOf(label[1]);if(a===b)return 1+PLAYABILITY.pair;
 const gap=Math.min(4,a-b-1),wheel=label[0]==='A'?0.5:1;
 return 1+(label[2]==='s'?PLAYABILITY.suited:PLAYABILITY.offsuit)-PLAYABILITY.gapStep*gap*wheel;
}
const r1=(v:number)=>Math.round(v*10)/10;

/** Stack depth and ante (2026/10/30, tournament charts): stack in BB for everyone, ante = dead money in the pot (a big
 * blind ante of 1BB is ante 1). Shorter stacks open smaller, may open all in at 25BB or less, and any raise that would
 * put in 45% of the stack or more becomes all in. */
/** rake (2026/10/31, owner: レーキの率ごとの表 3%・3BB／5%・5BB／10%・10BB): taken only from pots that see a flop
 * (no flop, no drop). bps = basis points (300 = 3%), capBb = the most taken from one pot, in big blinds. */
export type PreflopRake={bps:number;capBb:number};
export type PreflopConfig={stack:number;ante:number;rake?:PreflopRake;/** players at the table, 6 (default), 8 or 9 */seats?:number};
/** Pots keep growing after the flop, so the rake is worked out on the pot the hand usually ends with:
 * the preflop pot times this (limped and single-raised pots grow the most; an all-in pot is already final). */
export const RAKE_POT_GROWTH:Record<'limp'|'srp'|'3bp'|'4bp'|'allin'|'threeWay',number>={limp:2.5,srp:2.5,'3bp':1.6,'4bp':1.2,allin:1,threeWay:2.5};
export function rakeTaken(rake:PreflopRake|undefined,pot:number,kind:keyof typeof RAKE_POT_GROWTH){
 if(!rake||!(rake.bps>0))return 0;
 return Math.min(rake.capBb,pot*RAKE_POT_GROWTH[kind]*rake.bps/10000,pot);
}
export const DEFAULT_PREFLOP:PreflopConfig={stack:100,ante:0};
/** Build the simplified preflop tree. */
export function buildPreflopTree(cfg:PreflopConfig=DEFAULT_PREFLOP){
 const N=cfg.seats??6,SB=N-2,BB=N-1,NAMES=positionsFor(N),POST=postOrder(N),STACK=cfg.stack,J=(x:number)=>x>=STACK*0.45?STACK:x,OPEN=STACK>=50?2.5:STACK>=30?2.2:2,SB_OPEN=STACK>=50?3:2.5;
 const raiseAct=(to:number,label:string):PreflopAction=>to>=STACK?{label:'オールイン',kind:'allin',to:STACK}:{label,kind:'raise',to};
 let id=0;const decisions:PreflopDecision[]=[];
 const dec=(player:number,history:string,facing:number,actions:PreflopAction[],children:PreflopNode[]):PreflopDecision=>{const d:PreflopDecision={type:'decision',id:id++,player,history,facing,actions,children};decisions.push(d);return d;};
 const name=(p:number)=>NAMES[p];
 // Unopened pot: players fold in turn until someone opens.
 function unopened(p:number,inv:number[],history:string):PreflopNode{
  if(p===BB)return {type:'terminal',invested:inv,winner:BB};// folded to the big blind
  const open=p===SB?SB_OPEN:OPEN,next=unopened(p+1,inv,history+`${name(p)}F `);
  const opened=[...inv];opened[p]=open;
  // Folded to the small blind (2026/10/29): it may also limp; the big blind then checks or raises.
  if(p===SB){const limped=[...inv];limped[SB]=1;
   const acts:PreflopAction[]=[{label:'フォールド',kind:'fold'},{label:'リンプ（コール）',kind:'call'},{label:`オープン ${open}BB`,kind:'raise',to:open}],kids:PreflopNode[]=[next,bbVsLimp(limped,history+'SBC '),facingOpen(p,p+1,opened,history+`${name(p)}${open} `)];
   if(STACK<=25){const jam=[...inv];jam[p]=STACK;acts.push({label:'オールイン',kind:'allin',to:STACK});kids.push(facingOpenJam(p,p+1,jam,history+`${name(p)}AI `));}
   return dec(p,history,0,acts,kids);}
  const acts:PreflopAction[]=[{label:'フォールド',kind:'fold'},{label:`オープン ${open}BB`,kind:'raise',to:open}],kids:PreflopNode[]=[next,facingOpen(p,p+1,opened,history+`${name(p)}${open} `)];
  if(STACK<=25){const jam=[...inv];jam[p]=STACK;acts.push({label:'オールイン',kind:'allin',to:STACK});kids.push(facingOpenJam(p,p+1,jam,history+`${name(p)}AI `));}
  return dec(p,history,0,acts,kids);
 }
 // Opened all in (short stacks): each later player folds or calls; the first call goes to showdown heads-up.
 function facingOpenJam(o:number,p:number,inv:number[],history:string):PreflopNode{
  if(p>BB)return {type:'terminal',invested:inv,winner:o};
  const called=[...inv];called[p]=STACK;
  return dec(p,history,STACK,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'}],[facingOpenJam(o,p+1,inv,history+`${name(p)}F `),{type:'terminal',invested:called,showdown:{a:o,b:p,kind:'allin'}}]);
 }
 // Small blind limped: the big blind checks (a limped pot, SB first after the flop) or raises to 4BB.
 function bbVsLimp(inv:number[],history:string):PreflopNode{
  const raised=[...inv];raised[BB]=4;
  return dec(BB,history,1,[{label:'チェック',kind:'check'},{label:'レイズ 4BB',kind:'raise',to:4}],[{type:'terminal',invested:inv,showdown:{a:SB,b:BB,kind:'limp'}},sbVsIso(raised,history+'BB4 ')]);
 }
 function sbVsIso(inv:number[],history:string):PreflopNode{
  const three=J(12),called=[...inv];called[SB]=4;const raised=[...inv];raised[SB]=three;
  return dec(SB,history,4,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'},raiseAct(three,`3ベット ${three}BB`)],
   [{type:'terminal',invested:inv,winner:BB},{type:'terminal',invested:called,showdown:{a:SB,b:BB,kind:'srp',aggr:BB}},three>=STACK?facing5bet(BB,SB,raised,history+'SBAI '):bbVsLimp3bet(raised,history+'SB12 ')]);
 }
 function bbVsLimp3bet(inv:number[],history:string):PreflopNode{
  const called=[...inv];called[BB]=12;const jam=[...inv];jam[BB]=STACK;
  return dec(BB,history,12,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'},{label:'オールイン',kind:'allin',to:STACK}],
   [{type:'terminal',invested:inv,winner:SB},{type:'terminal',invested:called,showdown:{a:SB,b:BB,kind:'3bp',aggr:SB}},facing5bet(SB,BB,jam,history+'BBAI ')]);
 }
 // Players after the opener answer one by one: fold, call (heads-up to the flop) or 3-bet.
 function facingOpen(o:number,p:number,inv:number[],history:string):PreflopNode{
  if(p>BB)return {type:'terminal',invested:inv,winner:o};
  const open=inv[o],three=J(p>=SB?(o===SB?9:11):r1(open*3)),called=[...inv];called[p]=open;const raised=[...inv];raised[p]=three;
  return dec(p,history,open,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'},raiseAct(three,`3ベット ${three}BB`)],
   [facingOpen(o,p+1,inv,history+`${name(p)}F `),p<BB&&o!==SB?afterCall(o,p,p+1,called,history+`${name(p)}C `):{type:'terminal',invested:called,showdown:{a:o,b:p,kind:'srp',aggr:o}},three>=STACK?facing5bet(o,p,raised,history+`${name(p)}AI `):facing3bet(o,p,raised,history+`${name(p)}${three} `)]);
 }
 // After an open and a call, each later player may squeeze (2026/10/29); only the big blind may also call (a three-way
 // pot, at most three players).
 function afterCall(o:number,c:number,q:number,inv:number[],history:string):PreflopNode{
  if(q>BB)return {type:'terminal',invested:inv,showdown:{a:o,b:c,kind:'srp',aggr:o}};
  const open=inv[o],sq=J(q>=SB?12:10),raised=[...inv];raised[q]=sq;
  const acts:PreflopAction[]=[{label:'フォールド',kind:'fold'}],kids:PreflopNode[]=[afterCall(o,c,q+1,inv,history+`${name(q)}F `)];
  if(q===BB){const called=[...inv];called[BB]=open;acts.push({label:'コール',kind:'call'});kids.push({type:'terminal',invested:called,threeWay:[o,c,BB]});}
  acts.push(raiseAct(sq,`スクイーズ ${sq}BB`));kids.push(sq>=STACK?facing5bet(o,q,raised,history+`${name(q)}AI `):openerVsSqueeze(o,c,q,raised,history+`${name(q)}${sq} `));
  return dec(q,history,open,acts,kids);
 }
 // Squeezed: the opener folds, calls or moves all in; then the caller folds or calls (all in: the caller folds).
 function openerVsSqueeze(o:number,c:number,q:number,inv:number[],history:string):PreflopNode{
  const sq=inv[q],called=[...inv];called[o]=sq;const jam=[...inv];jam[o]=STACK;
  return dec(o,history,sq,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'},{label:'オールイン',kind:'allin',to:STACK}],
   [callerVsSqueeze(o,c,q,inv,true,history+`${name(o)}F `),callerVsSqueeze(o,c,q,called,false,history+`${name(o)}C `),facing5bet(q,o,jam,history+`${name(o)}AI `)]);
 }
 function callerVsSqueeze(o:number,c:number,q:number,inv:number[],openerFolded:boolean,history:string):PreflopNode{
  const sq=inv[q],called=[...inv];called[c]=sq;
  return dec(c,history,sq,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'}],
   [openerFolded?{type:'terminal',invested:inv,winner:q}:{type:'terminal',invested:inv,showdown:{a:o,b:q,kind:'3bp',aggr:q}},
    openerFolded?{type:'terminal',invested:called,showdown:{a:c,b:q,kind:'3bp',aggr:q}}:{type:'terminal',invested:called,threeWay:[o,c,q]}]);
 }
 function facing3bet(o:number,t:number,inv:number[],history:string):PreflopNode{
  const three=inv[t],ip=POST[o]>POST[t],four=J(r1(three*(ip?2.2:2.5))),called=[...inv];called[o]=three;const raised=[...inv];raised[o]=four;
  return dec(o,history,three,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'},raiseAct(four,`4ベット ${four}BB`)],
   [{type:'terminal',invested:inv,winner:t},{type:'terminal',invested:called,showdown:{a:o,b:t,kind:'3bp',aggr:t}},four>=STACK?facing5bet(t,o,raised,history+`${name(o)}AI `):facing4bet(o,t,raised,history+`${name(o)}${four} `)]);
 }
 function facing4bet(o:number,t:number,inv:number[],history:string):PreflopNode{
  const four=inv[o],called=[...inv];called[t]=four;const jam=[...inv];jam[t]=STACK;
  return dec(t,history,four,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'},{label:'オールイン',kind:'allin',to:STACK}],
   [{type:'terminal',invested:inv,winner:o},{type:'terminal',invested:called,showdown:{a:o,b:t,kind:'4bp',aggr:o}},facing5bet(o,t,jam,history+`${name(t)}AI `)]);
 }
 function facing5bet(o:number,t:number,inv:number[],history:string):PreflopNode{
  const called=[...inv];called[o]=STACK;
  return dec(o,history,STACK,[{label:'フォールド',kind:'fold'},{label:'コール',kind:'call'}],[{type:'terminal',invested:inv,winner:t},{type:'terminal',invested:called,showdown:{a:o,b:t,kind:'allin'}}]);
 }
 const blinds=new Array(N).fill(0);blinds[SB]=0.5;blinds[BB]=1;
 const root=unopened(0,blinds,'');
 return {root,decisions};
}

type Equity={labels:string[];eq:number[][]};
export class PreflopSolver{
 readonly n:number;readonly labels:string[];readonly combos:Float64Array;readonly prior:Float64Array;
 /** pair[i*n+j] = P(opponent holds class j | I hold class i), counting card removal. */
 readonly pair:Float64Array;readonly eq:Float64Array;readonly play:Float64Array;
 readonly root:PreflopNode;readonly decisions:PreflopDecision[];
 readonly regret:Float64Array[];readonly avg:Float64Array[];iterations=0;
 readonly cfg:PreflopConfig;readonly depth:number;readonly role:typeof REALIZE_ROLE;readonly seats:number;readonly post:number[];
 constructor(equity:Equity,cfg:PreflopConfig=DEFAULT_PREFLOP){
  this.cfg=cfg;this.seats=cfg.seats??6;this.post=postOrder(this.seats);const st=BY_STACK?.[String(cfg.stack)];this.depth=st?1:Math.sqrt(Math.min(1,cfg.stack/100));this.role={...REALIZE_ROLE,...(st?.role??{})} as typeof REALIZE_ROLE;
  const n=equity.labels.length;this.n=n;this.labels=equity.labels;
  this.combos=Float64Array.from(equity.labels,l=>l.length===2?6:l[2]==='s'?4:12);this.prior=Float64Array.from(this.combos,c=>c/1326);
  const ranks='23456789TJQKA',cards=equity.labels.map(l=>{const a=ranks.indexOf(l[0]),b=ranks.indexOf(l[1]),out:[number,number][]=[];
   for(let x=0;x<4;x++)for(let y=0;y<4;y++){if(a===b&&y<=x)continue;if(l[2]==='s'&&x!==y)continue;if(l[2]==='o'&&x===y)continue;if(a!==b&&!l[2])continue;out.push([a*4+x,b*4+y]);}return out;});
  this.pair=new Float64Array(n*n);this.eq=new Float64Array(n*n);this.play=Float64Array.from(equity.labels,l=>st?.play?.[l]??1+(playability(l)-1)*this.depth);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){let ok=0;for(const [p,q] of cards[i])for(const [r,s] of cards[j])if(p!==r&&p!==s&&q!==r&&q!==s)ok++;this.pair[i*n+j]=ok/(this.combos[i]*1225);this.eq[i*n+j]=equity.eq[i][j]/10000;}
  const {root,decisions}=buildPreflopTree(cfg);this.root=root;this.decisions=decisions;
  this.regret=decisions.map(d=>new Float64Array(n*d.actions.length));this.avg=decisions.map(d=>new Float64Array(n*d.actions.length));
 }
 strategy(d:PreflopDecision,average=false){
  const k=d.actions.length,n=this.n,src=average?this.avg[d.id]:this.regret[d.id],out=new Float64Array(n*k);
  for(let h=0;h<n;h++){let sum=0;for(let a=0;a<k;a++){const v=Math.max(0,src[h*k+a]);out[h*k+a]=v;sum+=v;}for(let a=0;a<k;a++)out[h*k+a]=sum>0?out[h*k+a]/sum:1/k;}
  return out;
 }
 /** Probability mass a player's range still has (prior × reach). */
 #mass(reach:Float64Array){let m=0;for(let h=0;h<this.n;h++)m+=this.prior[h]*reach[h];return m;}
 /** Counterfactual values: values[p][h] = expected chips for player p holding h, weighted by the others' reach. */
 #walk(node:PreflopNode,reach:Float64Array[]):Float64Array[]{
  const n=this.n,P=this.seats,POST=this.post;
  if(node.type==='terminal'){
   const mass=reach.map(r=>this.#mass(r)),values=Array.from({length:P},()=>new Float64Array(n));
   const pot=node.invested.reduce((s,v)=>s+v,0)+this.cfg.ante;
   if(node.winner!==undefined){
    for(let p=0;p<P;p++){let others=1;for(let q=0;q<P;q++)if(q!==p)others*=mass[q];const pay=(p===node.winner?pot:0)-node.invested[p];values[p].fill(pay*others);}
    return values;
   }
   if(node.threeWay)return this.#threeWay(node,reach,mass,pot-rakeTaken(this.cfg.rake,pot,'threeWay'));
   const {a,b,kind,aggr}=node.showdown!,won=pot-rakeTaken(this.cfg.rake,pot,kind),ip=POST[a]>POST[b]?a:b,oop=ip===a?b:a,role=kind==='srp'||kind==='3bp'||kind==='4bp'?this.role[kind]:null;
   // Shorter stacks leave less to play for after the flop: realisation moves towards 1 (by the square root of the depth).
   const sc=(r:number)=>1-(1-r)*this.depth,rOop=sc(role?(oop===aggr?role.aggr:role.call):REALIZE[kind][0]),rIp=sc(role?1:REALIZE[kind][1]);
   let rest=1;for(let q=0;q<P;q++)if(q!==a&&q!==b)rest*=mass[q];
   for(let p=0;p<P;p++)if(p!==a&&p!==b){let others=1;for(let q=0;q<P;q++)if(q!==p)others*=mass[q];values[p].fill(-node.invested[p]*others);}
   for(const [me,op] of [[a,b],[b,a]] as const){
    const rMe=me===ip?rIp:rOop,rOp=me===ip?rOop:rIp,ro=reach[op],v=values[me];
    const deep=kind!=='allin';for(let h=0;h<n;h++){let s=0;const pm=deep?this.play[h]:1;for(let o=0;o<n;o++){const w=this.pair[h*n+o]*ro[o];if(!w)continue;const e=this.eq[h*n+o],a1=e*rMe*pm,b1=(1-e)*rOp*(deep?this.play[o]:1),share=a1/(a1+b1);s+=w*(share*won-node.invested[me]);}v[h]=s*rest;}
   }
   return values;
  }
  const ev=this.#evOut,k=node.actions.length,p=node.player,sigma=this.strategy(node,!!ev),values=Array.from({length:P},()=>new Float64Array(n)),actionValues:Float64Array[]=[];
  for(let a=0;a<k;a++){
   const next=reach.map((r,q)=>{if(q!==p)return r;const out=new Float64Array(n);for(let h=0;h<n;h++)out[h]=r[h]*sigma[h*k+a];return out;});
   const child=this.#walk(node.children[a],next);actionValues.push(child[p]);
   for(let q=0;q<P;q++){const v=values[q],c=child[q];if(q===p){for(let h=0;h<n;h++)v[h]+=sigma[h*k+a]*c[h];}else for(let h=0;h<n;h++)v[h]+=c[h];}
  }
  if(ev){
   // Evaluation pass (actionEvs): per hand, what each action is worth in big blinds once the hand reaches this point.
   // The values above are weighted by how often the other players' ranges get here; divide that out.
   let others=1;for(let q=0;q<P;q++)if(q!==p)others*=this.#mass(reach[q]);
   const out=ev[node.id];for(let h=0;h<n;h++)for(let a=0;a<k;a++)out[h*k+a]=others>0?actionValues[a][h]/others:0;
   this.#evReach[node.id]=Float64Array.from(reach[p]);
   return values;
  }
  const regret=this.regret[node.id],avg=this.avg[node.id],t=this.iterations+1,pos=Math.pow(t,1.5)/(Math.pow(t,1.5)+1),wAvg=Math.pow(t/(t+1),2),r=reach[p];
  for(let h=0;h<n;h++)for(let a=0;a<k;a++){
   const i=h*k+a,g=actionValues[a][h]-values[p][h];regret[i]=(regret[i]>0?regret[i]*pos:0)+g;
   avg[i]=avg[i]*wAvg+r[h]*sigma[i];
  }
  return values;
 }
 /** Three-way pot after open, call and big blind call. Equity is approximated from the pairwise all-in equities and
  * scaled by position (first to act postflop realises least) and playability. */
 #threeWay(node:PreflopTerminal,reach:Float64Array[],mass:number[],pot:number){
  const n=this.n,P=this.seats,POST=this.post,[x,y,z]=node.threeWay!,values=Array.from({length:P},()=>new Float64Array(n));
  const order=[x,y,z].sort((u,v)=>POST[u]-POST[v]),R=new Map([[order[0],1-0.28*this.depth],[order[1],1-0.15*this.depth],[order[2],1.0]]);
  for(let p=0;p<P;p++)if(p!==x&&p!==y&&p!==z){let others=1;for(let q=0;q<P;q++)if(q!==p)others*=mass[q];values[p].fill(-node.invested[p]*others);}
  let rest=1;for(let q=0;q<P;q++)if(q!==x&&q!==y&&q!==z)rest*=mass[q];
  const eq=this.eq,pair=this.pair,play=this.play;
  for(const [me,b,c] of [[x,y,z],[y,x,z],[z,x,y]] as const){
   const rb=reach[b],rc=reach[c],Rm=R.get(me)!,Rb=R.get(b)!,Rc=R.get(c)!,inv=node.invested[me],v=values[me];
   for(let h=0;h<n;h++){let s=0;
    for(let i=0;i<n;i++){const wb=pair[h*n+i]*rb[i];if(!wb)continue;const ehb=eq[h*n+i],ebh=1-ehb;
     for(let j=0;j<n;j++){const wc=pair[h*n+j]*rc[j];if(!wc)continue;const ehc=eq[h*n+j],ebc=eq[i*n+j],ech=1-ehc,ecb=1-ebc;
      const em=ehb*ehc*Rm*play[h],eb=ebh*ebc*Rb*play[i],ec=ech*ecb*Rc*play[j];s+=wb*wc*(em/(em+eb+ec)*pot-inv);}}
    v[h]=s*rest;}
  }
  return values;
 }
 #evOut:Float64Array[]|null=null;#evReach:Float64Array[]=[];
 /** After actionEvs(): how often each hand of the deciding player gets to each decision (1 = always). */
 evReach(){return this.#evReach;}
 /** EV of every action for every hand at every decision, in big blinds, against the average strategy (no training).
  * evs[decision.id][hand*k+action]. Used for the trainer's EV loss. */
 actionEvs(){
  const out=this.decisions.map(d=>new Float64Array(this.n*d.actions.length));this.#evOut=out;
  try{this.#walk(this.root,Array.from({length:this.seats},()=>new Float64Array(this.n).fill(1)));}finally{this.#evOut=null;}
  return out;
 }
 run(iterations:number){for(let i=0;i<iterations;i++){this.#walk(this.root,Array.from({length:this.seats},()=>new Float64Array(this.n).fill(1)));this.iterations++;}}
 /** Average positive regret per decision and hand, in big blinds (smaller = closer to equilibrium). */
 averageRegret(){let s=0,c=0;for(const d of this.decisions){const k=d.actions.length,r=this.regret[d.id];for(let h=0;h<this.n;h++){let m=0;for(let a=0;a<k;a++)m=Math.max(m,r[h*k+a]);s+=m;c++;}}return s/c/Math.max(1,this.iterations);}
}

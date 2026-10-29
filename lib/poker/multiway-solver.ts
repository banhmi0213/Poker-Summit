/** Three-way postflop solver (2026/10/29: 3人以上のポットのGTO). Discounted CFR over hand combos from the flop, turn or
 * river with every turn and river card solved separately (as the heads-up solver).
 *
 * Players act in postflop order 0, 1, 2. A folded player's chips stay in the pot.
 * Approximation (stated on the page): card removal is exact between the hero and each opponent, but the two opponents'
 * hands are treated as independent of each other (their shared-card collisions are ignored). This keeps a showdown
 * at O(n log n) per player instead of O(n³), the usual trade-off in multiway solvers.
 * Three-player games have no unique equilibrium; the result is the CFR average strategy, reported with each player's
 * best-response gain (how much a player could win by deviating alone).
 */
import {evalCodes} from './fast-eval';
import type {Combo} from './postflop-solver';

export type MStreet='flop'|'turn'|'river';
export type MAction={label:string;kind:'check'|'bet'|'call'|'fold'|'raise'|'allin';to:number};
export type MActNode={kind:'act';street:MStreet;player:0|1|2;actions:MAction[];children:MNode[];id:number;path:string;contrib:number[];folded:boolean[]};
export type MChance={kind:'chance';street:'turn'|'river';child:MNode};
export type MEnd={kind:'end';contrib:number[];folded:boolean[];showdown:boolean;
 /** Betting closed before the river under a depth limit: share by equity over the remaining runouts. */
 equity?:boolean};
export type MNode=MActNode|MChance|MEnd;
export type MultiwaySpot={board:number[];pot:number;stack:number;ranges:[Combo[],Combo[],Combo[]];
 /** One street's menu: bet sizes as pot fractions; raises as multiples of the bet faced; at most maxRaises per street. */
 betSizes:number[];raiseSizes:number[];maxRaises:number;turnBetSizes?:number[];riverBetSizes?:number[];
 /** Offer all-in only when it is at most this many times the pot. Default 1.5. */
 allinMaxPot?:number;
 /** Solve only the first street: when its betting closes, the pot is shared by all-in equity over every remaining
  * runout (no later betting). Full three-way trees over the turn and river are too slow to precompute; this is the
  * usual depth-limited approach for multiway flops. */
 depthLimit?:boolean};

const NEXT={flop:'turn',turn:'river'} as const;
export const NO_CARDS=52*53+52;
const dealtCards=(ctx:number)=>[Math.floor(ctx/53),ctx%53].filter(c=>c<52);
const dealCard=(ctx:number,card:number)=>Math.floor(ctx/53)===52?card*53+52:Math.floor(ctx/53)*53+card;

export function buildMultiwayTree(spot:Omit<MultiwaySpot,'board'|'ranges'>,street:MStreet):MNode{
 const limited=!!spot.depthLimit;
 let id=0;const round=(v:number)=>Math.round(v*100)/100;
 const bets=(s:MStreet)=>s===street?spot.betSizes:s==='turn'?(spot.turnBetSizes??spot.betSizes):(spot.riverBetSizes??spot.betSizes);
 const end=(contrib:number[],folded:boolean[],showdown:boolean):MEnd=>({kind:'end',contrib:[...contrib],folded:[...folded],showdown});
 const close=(s:MStreet,contrib:number[],folded:boolean[],path:string):MNode=>{
  const alive=[0,1,2].filter(p=>!folded[p]);if(alive.length===1)return end(contrib,folded,false);
  if(s==='river')return end(contrib,folded,true);
  if(limited)return {...end(contrib,folded,true),equity:true};
  const allIn=alive.some(p=>contrib[p]>=spot.stack);
  if(allIn){let n:MNode=end(contrib,folded,true);if(s==='flop')n={kind:'chance',street:'river',child:n};return {kind:'chance',street:NEXT[s],child:n};}
  return {kind:'chance',street:NEXT[s],child:act(NEXT[s],contrib,folded,alive,0,0,path+'|')};
 };
 // `queue`: players who still have to act on this street, in order.
 const act=(s:MStreet,contrib:number[],folded:boolean[],queue:number[],facing:number,raises:number,path:string):MNode=>{
  if(!queue.length)return close(s,contrib,folded,path);
  const p=queue[0] as 0|1|2,rest=queue.slice(1),base=contrib[p],potNow=spot.pot+contrib.reduce((a,b)=>a+b,0);
  const behind=(c:number[],f:boolean[])=>[1,2].map(k=>(p+k)%3).filter(q=>!f[q]&&c[q]<spot.stack);
  const actions:MAction[]=[],children:MNode[]=[];
  const add=(a:MAction,child:()=>MNode)=>{if(!actions.some(x=>x.kind===a.kind&&x.to===a.to)){actions.push(a);children.push(child());}};
  const cap=spot.allinMaxPot??1.5;
  if(facing<=base){
   add({label:'チェック',kind:'check',to:base},()=>act(s,contrib,folded,rest,facing,raises,path+'x'));
   for(const f of bets(s)){const to=Math.min(spot.stack,round(base+f*potNow));if(to<=base)continue;const c=[...contrib];c[p]=to;
    add({label:to>=spot.stack?'オールイン':`ベット ${Math.round(f*100)}%`,kind:to>=spot.stack?'allin':'bet',to},()=>act(s,c,folded,behind(c,folded),to,raises,path+'b'+to));}
   if(spot.stack-base<=cap*potNow&&base<spot.stack){const c=[...contrib];c[p]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},()=>act(s,c,folded,behind(c,folded),spot.stack,raises,path+'a'));}
  }else{
   const f=[...folded];f[p]=true;
   add({label:'フォールド',kind:'fold',to:base},()=>act(s,contrib,f,rest.filter(q=>!f[q]),facing,raises,path+'f'));
   const c=[...contrib];c[p]=Math.min(spot.stack,facing);
   add({label:'コール',kind:'call',to:c[p]},()=>act(s,c,folded,rest,facing,raises,path+'c'));
   if(raises<spot.maxRaises&&facing<spot.stack){
    for(const m of spot.raiseSizes){const to=Math.min(spot.stack,round(base+m*(facing-base)));if(to<=facing)continue;const r=[...contrib];r[p]=to;
     add({label:to>=spot.stack?'オールイン':`レイズ ${m}倍`,kind:to>=spot.stack?'allin':'raise',to},()=>act(s,r,folded,behind(r,folded),to,raises+1,path+'r'+to));}
   }
  }
  return {kind:'act',street:s,player:p,actions,children,id:id++,path,contrib:[...contrib],folded:[...folded]};
 };
 return act(street,[0,0,0],[false,false,false],[0,1,2],0,0,'');
}

type Side={c1:Int32Array;c2:Int32Array;w:Float64Array;n:number;byCard:Int32Array[]};
function prepare(board:number[],combos:Combo[]):Side{
 const used=new Set(board),seen=new Set<number>();
 const list=combos.filter(c=>{const k=Math.min(c.c1,c.c2)*52+Math.max(c.c1,c.c2);if(c.weight<=0||c.c1===c.c2||used.has(c.c1)||used.has(c.c2)||seen.has(k))return false;seen.add(k);return true;});
 const n=list.length,c1=new Int32Array(n),c2=new Int32Array(n),w=new Float64Array(n);list.forEach((c,i)=>{c1[i]=c.c1;c2[i]=c.c2;w[i]=c.weight;});
 const byCard:Int32Array[]=[];for(let c=0;c<52;c++){const ids:number[]=[];for(let i=0;i<n;i++)if(c1[i]===c||c2[i]===c)ids.push(i);byCard[c]=Int32Array.from(ids);}
 return {c1,c2,w,n,byCard};
}

export class MultiwaySolver{
 readonly tree:MNode;readonly sides:[Side,Side,Side];readonly street:MStreet;readonly deck:number[];iterations=0;
 #nodes:MActNode[]=[];#regret=new Map<number,Float32Array>();#avg=new Map<number,Float32Array>();
 #strength=new Map<number,Float64Array[]>();#order=new Map<number,Int32Array[]>();
 constructor(readonly spot:MultiwaySpot){
  this.street=spot.board.length===3?'flop':spot.board.length===4?'turn':'river';
  this.deck=[...Array(52).keys()].filter(c=>!spot.board.includes(c));
  this.tree=buildMultiwayTree(spot,this.street);
  this.sides=[prepare(spot.board,spot.ranges[0]),prepare(spot.board,spot.ranges[1]),prepare(spot.board,spot.ranges[2])];
  const walk=(n:MNode)=>{if(n.kind==='act'){this.#nodes.push(n);n.children.forEach(walk);}else if(n.kind==='chance')walk(n.child);};walk(this.tree);
 }
 nodes(){return this.#nodes;}
 #dealable(ctx:number){const d=dealtCards(ctx);return this.deck.filter(c=>!d.includes(c));}
 /** Strengths (−1 = blocked by the board) and ascending order, per player, for the final board of `ctx`. */
 #showdown(ctx:number){
  const d=dealtCards(ctx).sort((a,b)=>a-b),key=(d[0]??52)*53+(d[1]??52);let s=this.#strength.get(key);
  if(!s){const board=[...this.spot.board,...d];s=this.sides.map(S=>{const st=new Float64Array(S.n);for(let i=0;i<S.n;i++)st[i]=board.includes(S.c1[i])||board.includes(S.c2[i])?-1:evalCodes([S.c1[i],S.c2[i],...board]);return st;});
   this.#strength.set(key,s);this.#order.set(key,s.map(st=>Int32Array.from([...Array(st.length).keys()].sort((a,b)=>st[a]-st[b]))));}
  return {strength:s,order:this.#order.get(key)!};
 }
 #table(map:Map<number,Float32Array>,node:MActNode,ctx:number){const k=node.id*2809+ctx;let t=map.get(k);if(!t){t=new Float32Array(this.sides[node.player].n*node.actions.length);map.set(k,t);}return t;}
 strategy(node:MActNode,average=false,ctx=NO_CARDS){
  const k=node.actions.length,n=this.sides[node.player].n,src=this.#table(average?this.#avg:this.#regret,node,ctx),out=new Float64Array(n*k);
  for(let h=0;h<n;h++){let sum=0;for(let a=0;a<k;a++)sum+=Math.max(0,src[h*k+a]);for(let a=0;a<k;a++)out[h*k+a]=sum>0?Math.max(0,src[h*k+a])/sum:1/k;}
  return out;
 }
 /** Opponent reach not sharing a card with each hero combo. */
 #compatible(hero:number,opp:number,r:Float64Array){
  const H=this.sides[hero],O=this.sides[opp],cards=new Float64Array(52);let total=0;
  for(let o=0;o<O.n;o++){const x=r[o];if(!x)continue;total+=x;cards[O.c1[o]]+=x;cards[O.c2[o]]+=x;}
  const out=new Float64Array(H.n);
  for(let h=0;h<H.n;h++){let v=total-cards[H.c1[h]]-cards[H.c2[h]];
   // the identical combo was subtracted twice
   const x=this.#same(hero,opp)[h];if(x>=0)v+=r[x];
   out[h]=v;}
  return out;
 }
 /** Opponent reach strictly weaker (below) and strictly stronger (above) than each hero combo, card removal exact. */
 #sweep(hero:number,opp:number,r:Float64Array,ctx:number){
  const {strength,order}=this.#showdown(ctx),HS=strength[hero],OS=strength[opp],HO=order[hero],OO=order[opp],H=this.sides[hero],O=this.sides[opp];
  const below=new Float64Array(H.n),above=new Float64Array(H.n),cs=new Float64Array(52);let sum=0,j=0;
  for(let x=0;x<H.n;x++){const h=HO[x],hs=HS[h];if(hs<0)continue;while(j<O.n&&OS[OO[j]]<hs){const o=OO[j++];if(OS[o]<0)continue;const v=r[o];if(v){sum+=v;cs[O.c1[o]]+=v;cs[O.c2[o]]+=v;}}below[h]=sum-cs[H.c1[h]]-cs[H.c2[h]];}
  cs.fill(0);sum=0;j=O.n-1;
  for(let x=H.n-1;x>=0;x--){const h=HO[x],hs=HS[h];if(hs<0)continue;while(j>=0&&OS[OO[j]]>hs){const o=OO[j--];const v=r[o];if(v){sum+=v;cs[O.c1[o]]+=v;cs[O.c2[o]]+=v;}}above[h]=sum-cs[H.c1[h]]-cs[H.c2[h]];}
  return {below,above};
 }
 #end(node:MEnd,hero:number,opps:[number,number],r:[Float64Array,Float64Array],ctx:number):Float64Array{
  if(node.equity&&node.showdown&&!node.folded[hero]&&!(node.folded[opps[0]]&&node.folded[opps[1]]))return this.#equityEnd(node,hero,opps,r,ctx);
  const H=this.sides[hero],total=this.spot.pot+node.contrib[0]+node.contrib[1]+node.contrib[2],me=node.contrib[hero];
  const ca=this.#compatible(hero,opps[0],r[0]),cb=this.#compatible(hero,opps[1],r[1]),out=new Float64Array(H.n);
  const blocked=(h:number)=>this.#showdown(ctx).strength[hero][h]<0;
  if(node.folded[hero]){for(let h=0;h<H.n;h++)out[h]=-me*ca[h]*cb[h];return out;}
  const aliveOpp=[0,1].filter(i=>!node.folded[opps[i]]);
  if(!aliveOpp.length){for(let h=0;h<H.n;h++)out[h]=(total-me)*ca[h]*cb[h];return out;}
  if(aliveOpp.length===1){
   // Heads-up showdown against the live opponent; the folded one only scales by its compatible reach.
   const i=aliveOpp[0],live=i===0?ca:cb,dead=i===0?cb:ca,{below,above}=this.#sweep(hero,opps[i],r[i],ctx);
   for(let h=0;h<H.n;h++){if(blocked(h))continue;const tie=live[h]-below[h]-above[h];out[h]=dead[h]*(below[h]*total+tie*total/2-live[h]*me);}
   return out;
  }
  const A=this.#sweep(hero,opps[0],r[0],ctx),B=this.#sweep(hero,opps[1],r[1],ctx);
  for(let h=0;h<H.n;h++){if(blocked(h))continue;
   const wa=A.below[h],ta=ca[h]-A.below[h]-A.above[h],wb=B.below[h],tb=cb[h]-B.below[h]-B.above[h];
   const share=wa*wb+0.5*(ta*wb+wa*tb)+ta*tb/3;out[h]=share*total-ca[h]*cb[h]*me;}
  return out;
 }
 /** Depth-limited showdown: the pot shared by equity over every remaining runout. Tight loops, no allocation per runout
  * (this is where the flop solve spends its time). */
 #equityEnd(node:MEnd,hero:number,opps:[number,number],r:[Float64Array,Float64Array],ctx:number):Float64Array{
  const H=this.sides[hero],hn=H.n,out=new Float64Array(hn),total=this.spot.pot+node.contrib[0]+node.contrib[1]+node.contrib[2],me=node.contrib[hero];
  const live=[0,1].filter(i=>!node.folded[opps[i]]),deck=this.#dealable(ctx),need=5-this.spot.board.length-dealtCards(ctx).length;
  const S=[this.sides[opps[0]],this.sides[opps[1]]],cs=new Float64Array(52);
  const below=[new Float64Array(hn),new Float64Array(hn)],above=[new Float64Array(hn),new Float64Array(hn)],comp=[new Float64Array(hn),new Float64Array(hn)];
  const run=(cx:number)=>{
   const {strength,order}=this.#showdown(cx),HS=strength[hero],HO=order[hero];
   for(let i=0;i<2;i++){
    const O=S[i],OS=strength[opps[i]],OO=order[opps[i]],ro=r[i],bl=below[i],ab=above[i],cp=comp[i],oc1=O.c1,oc2=O.c2,on=O.n;
    // compatible reach (opponent combo valid on this board and not sharing a hero card)
    cs.fill(0);let tot=0;for(let o=0;o<on;o++){if(OS[o]<0)continue;const v=ro[o];if(!v)continue;tot+=v;cs[oc1[o]]+=v;cs[oc2[o]]+=v;}
    const same=this.#same(hero,opps[i]);for(let h=0;h<hn;h++){if(HS[h]<0)continue;const x=same[h];cp[h]=tot-cs[H.c1[h]]-cs[H.c2[h]]+(x>=0&&OS[x]>=0?ro[x]:0);}
    if(!live.includes(i))continue;
    cs.fill(0);let sum=0,j=0;
    for(let x=0;x<hn;x++){const h=HO[x],hs=HS[h];if(hs<0)continue;while(j<on&&OS[OO[j]]<hs){const o=OO[j++];if(OS[o]<0)continue;const v=ro[o];if(v){sum+=v;cs[oc1[o]]+=v;cs[oc2[o]]+=v;}}bl[h]=sum-cs[H.c1[h]]-cs[H.c2[h]];}
    cs.fill(0);sum=0;j=on-1;
    for(let x=hn-1;x>=0;x--){const h=HO[x],hs=HS[h];if(hs<0)continue;while(j>=0&&OS[OO[j]]>hs){const o=OO[j--];const v=ro[o];if(v){sum+=v;cs[oc1[o]]+=v;cs[oc2[o]]+=v;}}ab[h]=sum-cs[H.c1[h]]-cs[H.c2[h]];}
   }
   if(live.length===2){
    const [ba,bb]=below,[aa,ab]=above,[ca,cb]=comp;
    for(let h=0;h<hn;h++){if(HS[h]<0)continue;const wa=ba[h],ta=ca[h]-wa-aa[h],wb=bb[h],tb=cb[h]-wb-ab[h];out[h]+=(wa*wb+0.5*(ta*wb+wa*tb)+ta*tb/3)*total-ca[h]*cb[h]*me;}
   }else{
    const i=live[0],bl=below[i],ab=above[i],lv=comp[i],dd=comp[1-i];
    for(let h=0;h<hn;h++){if(HS[h]<0)continue;const t=lv[h]-bl[h]-ab[h];out[h]+=dd[h]*(bl[h]*total+t*total/2-lv[h]*me);}
   }
  };
  if(need===1)for(const c of deck)run(dealCard(ctx,c));
  else for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)run(dealCard(dealCard(ctx,deck[i]),deck[j]));
  // A valid hand triple (six distinct cards) is dealt on exactly every runout that avoids its six cards.
  const free=deck.length-6,div=need===1?free:free*(free-1)/2;for(let h=0;h<hn;h++)out[h]/=div;
  return out;
 }
 /** For each hero combo, the index of the same two cards in the opponent's list (-1: none). */
 #sameCache=new Map<number,Int32Array>();
 #same(hero:number,opp:number){const k=hero*3+opp;let s=this.#sameCache.get(k);if(!s){const H=this.sides[hero],O=this.sides[opp],idx=new Map<number,number>();for(let o=0;o<O.n;o++)idx.set(Math.min(O.c1[o],O.c2[o])*52+Math.max(O.c1[o],O.c2[o]),o);s=new Int32Array(H.n);for(let h=0;h<H.n;h++)s[h]=idx.get(Math.min(H.c1[h],H.c2[h])*52+Math.max(H.c1[h],H.c2[h]))??-1;this.#sameCache.set(k,s);}return s;}
 #disc=[1,1];#w=1;
 /** Hero values given both opponents' reach. mode: train (update), avg (average strategies), br (hero best-responds). */
 #cfr(node:MNode,hero:number,r:[Float64Array,Float64Array],opps:[number,number],mode:'train'|'avg'|'br',ctx:number):Float64Array{
  const H=this.sides[hero];
  if(node.kind==='end')return this.#end(node,hero,opps,r,ctx);
  if(node.kind==='chance'){
   const cards=this.#dealable(ctx),div=cards.length-6,out=new Float64Array(H.n);
   for(const c of cards){
    const r2=r.map((x,i)=>{const y=Float64Array.from(x);for(const o of this.sides[opps[i]].byCard[c])y[o]=0;return y;}) as [Float64Array,Float64Array];
    const v=this.#cfr(node.child,hero,r2,opps,mode,dealCard(ctx,c));for(const h of H.byCard[c])v[h]=0;
    for(let h=0;h<H.n;h++)out[h]+=v[h];
   }
   for(let h=0;h<H.n;h++)out[h]/=div;return out;
  }
  const k=node.actions.length,s=this.strategy(node,mode!=='train',ctx),out=new Float64Array(H.n);
  if(node.player===hero){
   const vals=node.children.map(ch=>this.#cfr(ch,hero,r,opps,mode,ctx));
   for(let h=0;h<H.n;h++){let v=0;if(mode==='br'){v=-Infinity;for(let a=0;a<k;a++)v=Math.max(v,vals[a][h]);}else for(let a=0;a<k;a++)v+=s[h*k+a]*vals[a][h];out[h]=v;}
   if(mode==='train'){const reg=this.#table(this.#regret,node,ctx),[pos,neg]=this.#disc;for(let h=0;h<H.n;h++){const o=h*k;for(let a=0;a<k;a++){const x=reg[o+a];reg[o+a]=(x>0?x*pos:x*neg)+vals[a][h]-out[h];}}}
   return out;
  }
  const i=opps.indexOf(node.player),O=this.sides[node.player],ro=r[i];
  if(mode==='train'){const avg=this.#table(this.#avg,node,ctx),w=this.#w;for(let o=0;o<O.n;o++){const x=ro[o]*w;if(!x)continue;for(let a=0;a<k;a++)avg[o*k+a]+=x*s[o*k+a];}}
  for(let a=0;a<k;a++){
   const nr=new Float64Array(O.n);let any=false;for(let o=0;o<O.n;o++){const x=ro[o]*s[o*k+a];nr[o]=x;if(x)any=true;}
   if(!any)continue;const rr:[Float64Array,Float64Array]=i===0?[nr,r[1]]:[r[0],nr];
   const v=this.#cfr(node.children[a],hero,rr,opps,mode,ctx);for(let h=0;h<H.n;h++)out[h]+=v[h];
  }
  return out;
 }
 #opps(hero:number):[number,number]{return hero===0?[1,2]:hero===1?[0,2]:[0,1];}
 run(iterations:number){
  for(let it=0;it<iterations;it++){const t=++this.iterations,p=t-1;this.#w=t*t;this.#disc=[p>0?p**1.5/(p**1.5+1):0,p>0?0.5:0];
   for(const hero of [0,1,2]){const o=this.#opps(hero);this.#cfr(this.tree,hero,[Float64Array.from(this.sides[o[0]].w),Float64Array.from(this.sides[o[1]].w)],o,'train',NO_CARDS);}}
  return this;
 }
 /** Average value of `hero` per weighted hand triple (approximate normalisation: opponents independent). */
 #value(hero:number,mode:'avg'|'br'){
  const o=this.#opps(hero),v=this.#cfr(this.tree,hero,[Float64Array.from(this.sides[o[0]].w),Float64Array.from(this.sides[o[1]].w)],o,mode,NO_CARDS),H=this.sides[hero];
  const ca=this.#compatible(hero,o[0],this.sides[o[0]].w),cb=this.#compatible(hero,o[1],this.sides[o[1]].w);
  let num=0,den=0;for(let h=0;h<H.n;h++){num+=H.w[h]*v[h];den+=H.w[h]*ca[h]*cb[h];}return num/den;
 }
 values(){return [0,1,2].map(p=>this.#value(p,'avg'));}
 /** Each player's gain from best-responding alone, as a share of the starting pot (0 at an equilibrium). */
 exploitability(){const avg=this.values();return [0,1,2].map(p=>(this.#value(p,'br')-avg[p])/this.spot.pot);}
}

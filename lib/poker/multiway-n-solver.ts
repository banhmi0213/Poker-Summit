/** Many-player postflop solver (2026/10/30: 4人以上のポットも近似で GTO の目安を出す). Discounted CFR over hand combos for
 * 2〜6 players on the current street only (depth-limited): when the street's betting closes, the pot is shared by
 * equity over the remaining runouts (all of them on the turn, an even sample of them on the flop).
 *
 * Approximations (shown as 「近似値」 on every page that uses it):
 * - opponents' hands are treated as independent of each other (card removal is exact between the hero and each one);
 * - later streets are not played out (equity at the end of the street);
 * - one bet size and one raise size per street.
 * Games with three or more players have no unique equilibrium; the result is the CFR average strategy.
 */
import {evalCodes} from './fast-eval';
import type {Combo} from './postflop-solver';

export type NAction={label:string;kind:'check'|'bet'|'call'|'fold'|'raise'|'allin';to:number};
export type NActNode={kind:'act';player:number;actions:NAction[];children:NNode[];id:number;contrib:number[];folded:boolean[]};
export type NEnd={kind:'end';contrib:number[];folded:boolean[]};
export type NNode=NActNode|NEnd;
export type NSpot={board:number[];pot:number;stack:number;ranges:Combo[][];betSizes:number[];raiseSizes:number[];maxRaises:number;allinMaxPot?:number;
 /** How many runouts to sample for the end-of-street equity (flop: turn+river pairs, turn: river cards). Default 8 / 10. */
 flopRunouts?:number;turnRunouts?:number;
 /** Keep at most this many combos per player (the heaviest). Default 220. */
 maxCombos?:number};

export function buildNTree(spot:Omit<NSpot,'board'|'ranges'>,players:number):NNode{
 let id=0;const round=(v:number)=>Math.round(v*100)/100,cap=spot.allinMaxPot??1.5;
 const end=(c:number[],f:boolean[]):NEnd=>({kind:'end',contrib:[...c],folded:[...f]});
 const act=(contrib:number[],folded:boolean[],queue:number[],facing:number,raises:number):NNode=>{
  if(!queue.length||folded.filter(x=>!x).length<=1)return end(contrib,folded);
  const p=queue[0],rest=queue.slice(1),base=contrib[p],potNow=spot.pot+contrib.reduce((a,b)=>a+b,0);
  const behind=(c:number[],f:boolean[])=>Array.from({length:players-1},(_,k)=>(p+1+k)%players).filter(q=>!f[q]&&c[q]<spot.stack);
  const actions:NAction[]=[],children:NNode[]=[];
  const add=(a:NAction,child:()=>NNode)=>{if(!actions.some(x=>x.kind===a.kind&&x.to===a.to)){actions.push(a);children.push(child());}};
  if(facing<=base){
   add({label:'チェック',kind:'check',to:base},()=>act(contrib,folded,rest,facing,raises));
   for(const f of spot.betSizes){const to=Math.min(spot.stack,round(base+f*potNow));if(to<=base)continue;const c=[...contrib];c[p]=to;
    add({label:to>=spot.stack?'オールイン':`ベット ${Math.round(f*100)}%`,kind:to>=spot.stack?'allin':'bet',to},()=>act(c,folded,behind(c,folded),to,raises));}
   if(spot.stack-base<=cap*potNow&&base<spot.stack){const c=[...contrib];c[p]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},()=>act(c,folded,behind(c,folded),spot.stack,raises));}
  }else{
   const f=[...folded];f[p]=true;
   add({label:'フォールド',kind:'fold',to:base},()=>act(contrib,f,rest.filter(q=>!f[q]),facing,raises));
   const c=[...contrib];c[p]=Math.min(spot.stack,facing);
   add({label:'コール',kind:'call',to:c[p]},()=>act(c,folded,rest,facing,raises));
   if(raises<spot.maxRaises&&facing<spot.stack){
    for(const m of spot.raiseSizes){const to=Math.min(spot.stack,round(base+m*(facing-base)));if(to<=facing)continue;const r=[...contrib];r[p]=to;
     add({label:to>=spot.stack?'オールイン':`レイズ ${m}倍`,kind:to>=spot.stack?'allin':'raise',to},()=>act(r,folded,behind(r,folded),to,raises+1));}
   }
  }
  return {kind:'act',player:p,actions,children,id:id++,contrib:[...contrib],folded:[...folded]};
 };
 return act(new Array(players).fill(0),new Array(players).fill(false),[...Array(players).keys()],0,0);
}

type Side={c1:Int32Array;c2:Int32Array;w:Float64Array;n:number};
function prepare(board:number[],combos:Combo[]):Side{
 const used=new Set(board),seen=new Set<number>();
 const list=combos.filter(c=>{const k=Math.min(c.c1,c.c2)*52+Math.max(c.c1,c.c2);if(c.weight<=0||c.c1===c.c2||used.has(c.c1)||used.has(c.c2)||seen.has(k))return false;seen.add(k);return true;});
 const n=list.length,c1=new Int32Array(n),c2=new Int32Array(n),w=new Float64Array(n);list.forEach((c,i)=>{c1[i]=c.c1;c2[i]=c.c2;w[i]=c.weight;});
 return {c1,c2,w,n};
}
/** Even sample of `k` items (deterministic). */
function sample<T>(xs:T[],k:number){if(xs.length<=k)return xs;const out:T[]=[];for(let i=0;i<k;i++)out.push(xs[Math.floor((i+0.5)*xs.length/k)]);return out;}

export class NWaySolver{
 readonly tree:NNode;readonly sides:Side[];readonly players:number;iterations=0;
 #nodes:NActNode[]=[];#regret=new Map<number,Float32Array>();#avg=new Map<number,Float32Array>();
 /** Runouts (extra board cards) and, per runout, strength (−1: blocked) and ascending order per player. */
 #runouts:number[][];#strength:Float64Array[][]=[];#order:Int32Array[][]=[];
 #flat:Float64Array[];#flatOrder:Int32Array[];
 #disc=[1,1];#w=1;
 constructor(readonly spot:NSpot){
  this.players=spot.ranges.length;if(this.players<2||this.players>6)throw new Error('2〜6人');
  this.tree=buildNTree(spot,this.players);
  const cap=spot.maxCombos??220;
  this.sides=spot.ranges.map(r=>prepare(spot.board,r.length>cap?[...r].sort((a,b)=>b.weight-a.weight).slice(0,cap):r));
  const deck=[...Array(52).keys()].filter(c=>!spot.board.includes(c));
  if(spot.board.length===5)this.#runouts=[[]];
  else if(spot.board.length===4)this.#runouts=sample(deck.map(c=>[c]),spot.turnRunouts??10);
  else{const pairs:number[][]=[];for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)pairs.push([deck[i],deck[j]]);
   // Spread the sample over the turn card first so every suit and rank shows up.
   pairs.sort((a,b)=>((a[0]*31+a[1]*17)%997)-((b[0]*31+b[1]*17)%997));this.#runouts=sample(pairs,spot.flopRunouts??8);}
  for(const extra of this.#runouts){const board=[...spot.board,...extra];
   const st=this.sides.map(S=>{const s=new Float64Array(S.n);for(let i=0;i<S.n;i++)s[i]=board.includes(S.c1[i])||board.includes(S.c2[i])?-1:evalCodes([S.c1[i],S.c2[i],...board]);return s;});
   this.#strength.push(st);this.#order.push(st.map(s=>Int32Array.from([...Array(s.length).keys()].sort((a,b)=>s[a]-s[b]))));}
  this.#flat=this.sides.map(S=>new Float64Array(S.n));this.#flatOrder=this.sides.map(S=>Int32Array.from([...Array(S.n).keys()]));
  const walk=(n:NNode)=>{if(n.kind==='act'){this.#nodes.push(n);n.children.forEach(walk);}};walk(this.tree);
 }
 nodes(){return this.#nodes;}
 #table(map:Map<number,Float32Array>,node:NActNode){let t=map.get(node.id);if(!t){t=new Float32Array(this.sides[node.player].n*node.actions.length);map.set(node.id,t);}return t;}
 strategy(node:NActNode,average=false){
  const k=node.actions.length,n=this.sides[node.player].n,src=this.#table(average?this.#avg:this.#regret,node),out=new Float64Array(n*k);
  for(let h=0;h<n;h++){let sum=0;for(let a=0;a<k;a++)sum+=Math.max(0,src[h*k+a]);for(let a=0;a<k;a++)out[h*k+a]=sum>0?Math.max(0,src[h*k+a])/sum:1/k;}
  return out;
 }
 /** Hero's value per combo at a terminal: pot shared by equity over the runouts (opponents independent). */
 #end(node:NEnd,hero:number,r:Float64Array[]):Float64Array{
  const H=this.sides[hero],hn=H.n,out=new Float64Array(hn),total=this.spot.pot+node.contrib.reduce((a,b)=>a+b,0),me=node.contrib[hero];
  const opps=[...Array(this.players).keys()].filter(p=>p!==hero),live=opps.filter(p=>!node.folded[p]);
  const comp=opps.map(()=>new Float64Array(hn)),below=opps.map(()=>new Float64Array(hn)),above=opps.map(()=>new Float64Array(hn));
  const cs=new Float64Array(52),count=new Float64Array(hn),coef=new Float64Array(this.players);
  // Showdown only when two or more are left; otherwise the result is the same on every runout.
  const showdown=!node.folded[hero]&&live.length>0;
  const runs=showdown?this.#runouts.length:1;
  for(let x=0;x<runs;x++){
   // Without a showdown no runout matters: no card is blocked beyond the board.
   const ST=showdown?this.#strength[x]:this.#flat,OR=showdown?this.#order[x]:this.#flatOrder;
   const HS=ST[hero],HO=OR[hero];
   opps.forEach((o,i)=>{
    const O=this.sides[o],OS=ST[o],OO=OR[o],ro=r[o],cp=comp[i];
    cs.fill(0);let tot=0;for(let q=0;q<O.n;q++){if(OS[q]<0)continue;const v=ro[q];if(!v)continue;tot+=v;cs[O.c1[q]]+=v;cs[O.c2[q]]+=v;}
    for(let h=0;h<hn;h++)if(HS[h]>=0)cp[h]=tot-cs[H.c1[h]]-cs[H.c2[h]];
    // a combo with both of the hero's cards was subtracted twice: add it back once
    const same=this.#same(hero,o);for(let h=0;h<hn;h++){const q=same[h];if(q>=0&&HS[h]>=0&&OS[q]>=0)cp[h]+=ro[q];}
    if(!showdown||node.folded[o])return;
    const bl=below[i],ab=above[i];cs.fill(0);let sum=0,j=0;
    for(let y=0;y<hn;y++){const h=HO[y],hs=HS[h];if(hs<0)continue;while(j<O.n&&OS[OO[j]]<hs){const q=OO[j++];if(OS[q]<0)continue;const v=ro[q];if(v){sum+=v;cs[O.c1[q]]+=v;cs[O.c2[q]]+=v;}}bl[h]=sum-cs[H.c1[h]]-cs[H.c2[h]];}
    cs.fill(0);sum=0;j=O.n-1;
    for(let y=hn-1;y>=0;y--){const h=HO[y],hs=HS[h];if(hs<0)continue;while(j>=0&&OS[OO[j]]>hs){const q=OO[j--];const v=ro[q];if(v){sum+=v;cs[O.c1[q]]+=v;cs[O.c2[q]]+=v;}}ab[h]=sum-cs[H.c1[h]]-cs[H.c2[h]];}
   });
   for(let h=0;h<hn;h++){
    if(HS[h]<0)continue;count[h]++;
    let all=1;for(let i=0;i<opps.length;i++)all*=comp[i][h];
    if(node.folded[hero]){out[h]+=-me*all;continue;}
    if(!live.length){out[h]+=(total-me)*all;continue;}
    // Π over live opponents of (below + tie·x): coefficient k = no one above and k opponents tied.
    coef.fill(0);coef[0]=1;let deg=0,dead=1;
    opps.forEach((o,i)=>{
     if(node.folded[o]){dead*=comp[i][h];return;}
     const w=below[i][h],t=comp[i][h]-below[i][h]-above[i][h];
     for(let d=deg+1;d>=1;d--)coef[d]=coef[d]*w+coef[d-1]*t;coef[0]*=w;deg++;
    });
    let share=0;for(let d=0;d<=deg;d++)share+=coef[d]/(d+1);
    out[h]+=share*dead*total-me*all;
   }
  }
  for(let h=0;h<hn;h++)if(count[h]>0)out[h]/=count[h];
  return out;
 }
 #sameCache=new Map<number,Int32Array>();
 #same(hero:number,opp:number){const k=hero*8+opp;let s=this.#sameCache.get(k);if(!s){const H=this.sides[hero],O=this.sides[opp],idx=new Map<number,number>();for(let o=0;o<O.n;o++)idx.set(Math.min(O.c1[o],O.c2[o])*52+Math.max(O.c1[o],O.c2[o]),o);s=new Int32Array(H.n);for(let h=0;h<H.n;h++)s[h]=idx.get(Math.min(H.c1[h],H.c2[h])*52+Math.max(H.c1[h],H.c2[h]))??-1;this.#sameCache.set(k,s);}return s;}
 #cfr(node:NNode,hero:number,r:Float64Array[],train:boolean):Float64Array{
  const H=this.sides[hero];
  if(node.kind==='end')return this.#end(node,hero,r);
  const k=node.actions.length,s=this.strategy(node,!train),out=new Float64Array(H.n);
  if(node.player===hero){
   const vals=node.children.map(ch=>this.#cfr(ch,hero,r,train));
   for(let h=0;h<H.n;h++){let v=0;for(let a=0;a<k;a++)v+=s[h*k+a]*vals[a][h];out[h]=v;}
   if(train){const reg=this.#table(this.#regret,node),[pos,neg]=this.#disc;for(let h=0;h<H.n;h++){const o=h*k;for(let a=0;a<k;a++){const x=reg[o+a];reg[o+a]=(x>0?x*pos:x*neg)+vals[a][h]-out[h];}}}
   return out;
  }
  const p=node.player,O=this.sides[p],ro=r[p];
  if(train){const avg=this.#table(this.#avg,node),w=this.#w;for(let o=0;o<O.n;o++){const x=ro[o]*w;if(!x)continue;for(let a=0;a<k;a++)avg[o*k+a]+=x*s[o*k+a];}}
  for(let a=0;a<k;a++){
   const nr=new Float64Array(O.n);let any=false;for(let o=0;o<O.n;o++){const x=ro[o]*s[o*k+a];nr[o]=x;if(x)any=true;}
   if(!any)continue;const rr=r.slice();rr[p]=nr;
   const v=this.#cfr(node.children[a],hero,rr,train);for(let h=0;h<H.n;h++)out[h]+=v[h];
  }
  return out;
 }
 run(iterations:number){
  for(let it=0;it<iterations;it++){const t=++this.iterations,p=t-1;this.#w=t*t;this.#disc=[p>0?p**1.5/(p**1.5+1):0,p>0?0.5:0];
   for(let hero=0;hero<this.players;hero++)this.#cfr(this.tree,hero,this.sides.map(S=>Float64Array.from(S.w)),true);}
  return this;
 }
}

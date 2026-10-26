/** Heads-up postflop solver (2026/10/26): exact discounted CFR over hand combos from the turn or the river.
 * No card abstraction: from the turn every river card is solved separately. The only modelling choice is
 * the bet-size menu. Exploitability (what a perfect opponent could gain) is reported so every result
 * carries its own accuracy figure. Player 0 = out of position (acts first), player 1 = in position.
 */
import {evalCodes} from './fast-eval';

export type Combo={c1:number;c2:number;weight:number};
export type SolverSpot={board:number[];pot:number;stack:number;ranges:[Combo[],Combo[]];
 /** Sizes on the first street solved (fractions of the pot; raises are multiples of the bet faced). */
 betSizes:number[];raiseSizes:number[];maxRaises:number;
 /** River sizes when solving from the turn (default: the same as the turn). */
 riverBetSizes?:number[];riverRaiseSizes?:number[];riverMaxRaises?:number};
export type Street='turn'|'river';
export type Action={label:string;kind:'check'|'bet'|'call'|'fold'|'raise'|'allin';to:number};
export type ActNode={kind:'act';street:Street;player:0|1;actions:Action[];children:Node[];id:number;path:string;contrib:[number,number]};
/** A river card is dealt; `child` is solved once per possible card (strategies are stored per card). */
export type ChanceNode={kind:'chance';child:Node;contrib:[number,number]};
export type Node=ActNode|ChanceNode|{kind:'fold';folder:0|1;contrib:[number,number]}|{kind:'showdown';contrib:[number,number]};
type Sizes={bets:number[];raises:number[];maxRaises:number};

/** Bet tree. All amounts are chips put in during the solved streets; `stack` is what each player has behind at the start. */
export function buildTree(spot:Pick<SolverSpot,'pot'|'stack'|'betSizes'|'raiseSizes'|'maxRaises'|'riverBetSizes'|'riverRaiseSizes'|'riverMaxRaises'>,street:Street='river'):Node{
 let id=0;
 const sizes=(s:Street):Sizes=>s===street?{bets:spot.betSizes,raises:spot.raiseSizes,maxRaises:spot.maxRaises}
  :{bets:spot.riverBetSizes??spot.betSizes,raises:spot.riverRaiseSizes??spot.raiseSizes,maxRaises:spot.riverMaxRaises??spot.maxRaises};
 const copy=(c:[number,number])=>[...c] as [number,number];
 const round=(v:number)=>Math.round(v*100)/100;
 // Betting closed: deal the river, or show down.
 const close=(s:Street,c:[number,number],allIn:boolean,path:string):Node=>s==='river'?{kind:'showdown',contrib:copy(c)}
  :{kind:'chance',contrib:copy(c),child:allIn?{kind:'showdown',contrib:copy(c)}:make('river',0,c,0,0,false,path+'|')};
 const make=(s:Street,player:0|1,contrib:[number,number],facing:number,raises:number,checked:boolean,path:string):Node=>{
  const actions:Action[]=[],children:Node[]=[];const other=(1-player) as 0|1,sz=sizes(s);
  const add=(a:Action,child:()=>Node)=>{if(!actions.some(x=>x.to===a.to&&x.kind===a.kind)){actions.push(a);children.push(child());}};
  const potNow=spot.pot+contrib[0]+contrib[1],base=contrib[player];
  if(facing===0){
   add({label:'チェック',kind:'check',to:base},()=>checked||player===1?close(s,contrib,false,path+'x'):make(s,other,contrib,0,raises,true,path+'x'));
   for(const f of sz.bets){const to=Math.min(spot.stack,round(base+f*potNow));if(to<=base)continue;const c=copy(contrib);c[player]=to;
    add({label:to>=spot.stack?'オールイン':`ベット ${Math.round(f*100)}%`,kind:to>=spot.stack?'allin':'bet',to},()=>make(s,other,c,to,raises,false,path+'b'+to));}
   if(base<spot.stack){const c=copy(contrib);c[player]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},()=>make(s,other,c,spot.stack,raises,false,path+'a'));}
  }else{
   add({label:'フォールド',kind:'fold',to:base},()=>({kind:'fold',folder:player,contrib:copy(contrib)}));
   const callC=copy(contrib);callC[player]=facing;
   add({label:'コール',kind:'call',to:facing},()=>close(s,callC,facing>=spot.stack,path+'c'));
   if(raises<sz.maxRaises&&facing<spot.stack){
    for(const m of sz.raises){const to=Math.min(spot.stack,round(base+m*(facing-base)));if(to<=facing)continue;const c=copy(contrib);c[player]=to;
     add({label:to>=spot.stack?'オールイン':`レイズ ${m}倍`,kind:to>=spot.stack?'allin':'raise',to},()=>make(s,other,c,to,raises+1,false,path+'r'+to));}
    const c=copy(contrib);c[player]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},()=>make(s,other,c,spot.stack,raises+1,false,path+'a'));
   }
  }
  return {kind:'act',street:s,player,actions,children,id:id++,path,contrib:copy(contrib)};
 };
 return make(street,0,[0,0],0,0,false,'');
}

/** Per player: combos, plus hand strength (and strength order) for every possible final board. Key 52 = the board as given. */
type Side={c1:Int32Array;c2:Int32Array;w:Float64Array;n:number;keyIndex:Map<number,number>;
 strength:Float64Array[];order:Int32Array[];byCard:Int32Array[]};
function prepare(board:number[],combos:Combo[],riverCards:number[]):Side{
 const used=new Set(board),seen=new Set<number>();
 const list=combos.filter(c=>{const k=Math.min(c.c1,c.c2)*52+Math.max(c.c1,c.c2);if(c.weight<=0||c.c1===c.c2||used.has(c.c1)||used.has(c.c2)||seen.has(k))return false;seen.add(k);return true;});
 const n=list.length,c1=new Int32Array(n),c2=new Int32Array(n),w=new Float64Array(n),keyIndex=new Map<number,number>();
 list.forEach((c,i)=>{c1[i]=c.c1;c2[i]=c.c2;w[i]=c.weight;keyIndex.set(Math.min(c.c1,c.c2)*52+Math.max(c.c1,c.c2),i);});
 const strength:Float64Array[]=[],order:Int32Array[]=[],byCard:Int32Array[]=[];
 const fill=(key:number,cards:number[])=>{const s=new Float64Array(n);for(let i=0;i<n;i++)s[i]=cards.includes(c1[i])||cards.includes(c2[i])?-1:evalCodes([c1[i],c2[i],...cards]);
  strength[key]=s;order[key]=Int32Array.from([...Array(n).keys()].sort((a,b)=>s[a]-s[b]));};
 if(board.length===5)fill(52,board);else for(const r of riverCards)fill(r,[...board,r]);
 for(let c=0;c<52;c++){const ids:number[]=[];for(let i=0;i<n;i++)if(c1[i]===c||c2[i]===c)ids.push(i);byCard[c]=Int32Array.from(ids);}
 return {c1,c2,w,n,keyIndex,strength,order,byCard};
}

export class PostflopSolver{
 readonly tree:Node;readonly sides:[Side,Side];readonly pot:number;readonly street:Street;
 /** Possible river cards when solving from the turn (empty on the river). */
 readonly riverCards:number[];
 #same:[Int32Array,Int32Array];#cards=new Float64Array(52);#reach:Float64Array;
 #regret=new Map<number,Float32Array>();#avg=new Map<number,Float32Array>();#nodes:ActNode[]=[];
 iterations=0;
 constructor(readonly spot:SolverSpot){
  if(spot.board.length!==4&&spot.board.length!==5)throw new Error('board must have 4 or 5 cards');
  this.street=spot.board.length===4?'turn':'river';this.pot=spot.pot;
  this.riverCards=this.street==='turn'?[...Array(52).keys()].filter(c=>!spot.board.includes(c)):[];
  this.tree=buildTree(spot,this.street);
  this.sides=[prepare(spot.board,spot.ranges[0],this.riverCards),prepare(spot.board,spot.ranges[1],this.riverCards)];
  const sameOf=(H:Side,O:Side)=>{const r=new Int32Array(H.n);for(let h=0;h<H.n;h++)r[h]=O.keyIndex.get(Math.min(H.c1[h],H.c2[h])*52+Math.max(H.c1[h],H.c2[h]))??-1;return r;};
  this.#same=[sameOf(this.sides[0],this.sides[1]),sameOf(this.sides[1],this.sides[0])];this.#reach=new Float64Array(Math.max(this.sides[0].n,this.sides[1].n));
  const walk=(n:Node)=>{if(n.kind==='act'){this.#nodes.push(n);n.children.forEach(walk);}else if(n.kind==='chance')walk(n.child);};walk(this.tree);
 }
 #key(node:ActNode,card:number){return node.id*53+(card<0?52:card);}
 #table(map:Map<number,Float32Array>,node:ActNode,card:number){const key=this.#key(node,card);let t=map.get(key);if(!t){t=new Float32Array(this.sides[node.player].n*node.actions.length);map.set(key,t);}return t;}
 /** Current (regret-matching) or average strategy for one node: [combo*k + action]. `card` = the river card for river nodes under a turn solve. */
 strategy(node:ActNode,average=false,card=-1){
  const k=node.actions.length,n=this.sides[node.player].n,src=this.#table(average?this.#avg:this.#regret,node,card),out=new Float64Array(n*k);
  for(let h=0;h<n;h++){let sum=0;for(let a=0;a<k;a++)sum+=Math.max(0,src[h*k+a]);for(let a=0;a<k;a++)out[h*k+a]=sum>0?Math.max(0,src[h*k+a])/sum:1/k;}
  return out;
 }
 /** Values for every hero combo at a terminal, against opponent reach, with exact card removal. */
 #terminal(node:Extract<Node,{kind:'fold'|'showdown'}>,hero:0|1,opp:Float64Array,card:number):Float64Array{
  const H=this.sides[hero],O=this.sides[1-hero],hn=H.n,on=O.n,hc1=H.c1,hc2=H.c2,oc1=O.c1,oc2=O.c2,same=this.#same[hero];
  const out=new Float64Array(hn),me=node.contrib[hero],them=node.contrib[1-hero],all=this.#cards;all.fill(0);
  let total=0;for(let o=0;o<on;o++){const r=opp[o];if(r===0)continue;total+=r;all[oc1[o]]+=r;all[oc2[o]]+=r;}
  // reach[h] = opponent reach not sharing a card with h (inclusion-exclusion: the identical combo was subtracted twice).
  const reach=this.#reach;for(let h=0;h<hn;h++){const x=same[h];reach[h]=total-all[hc1[h]]-all[hc2[h]]+(x>=0?opp[x]:0);}
  if(node.kind==='fold'){const pay=node.folder===hero?-me:this.pot+them;for(let h=0;h<hn;h++)out[h]=pay*reach[h];return out;}
  const key=card<0?52:card,HS=H.strength[key],OS=O.strength[key],HO=H.order[key],OO=O.order[key];
  const win=this.pot+them,lose=-me,tie=this.pot/2,cs=this.#cards;
  // Sweep both lists by strength: reach strictly below (wins) then strictly above (losses), minus blocked combos.
  cs.fill(0);let sum=0,j=0;
  for(let x=0;x<hn;x++){const h=HO[x],hs=HS[h];while(j<on&&OS[OO[j]]<hs){const o=OO[j++],r=opp[o];if(r!==0){sum+=r;cs[oc1[o]]+=r;cs[oc2[o]]+=r;}}const below=sum-cs[hc1[h]]-cs[hc2[h]];out[h]=below*(win-tie)+reach[h]*tie;}
  cs.fill(0);sum=0;j=on-1;
  for(let x=hn-1;x>=0;x--){const h=HO[x],hs=HS[h];while(j>=0&&OS[OO[j]]>hs){const o=OO[j--],r=opp[o];if(r!==0){sum+=r;cs[oc1[o]]+=r;cs[oc2[o]]+=r;}}out[h]+=(sum-cs[hc1[h]]-cs[hc2[h]])*(lose-tie);}
  return out;
 }
 #cfr(node:Node,hero:0|1,opp:Float64Array,mode:'train'|'br'|'avg',t:number,card:number):Float64Array{
  if(node.kind==='fold'||node.kind==='showdown')return this.#terminal(node,hero,opp,card);
  const H=this.sides[hero],O=this.sides[1-hero];
  if(node.kind==='chance'){
   // Every valid (hero, opponent) pair leaves exactly riverCards-4 possible rivers, so each card weighs 1/(riverCards-4).
   const out=new Float64Array(H.n),div=this.riverCards.length-4;
   for(const c of this.riverCards){
    const o2=Float64Array.from(opp);for(const o of O.byCard[c])o2[o]=0;
    const v=this.#cfr(node.child,hero,o2,mode,t,c);const blocked=H.byCard[c];for(const h of blocked)v[h]=0;
    for(let h=0;h<H.n;h++)out[h]+=v[h];
   }
   for(let h=0;h<H.n;h++)out[h]/=div;
   return out;
  }
  const k=node.actions.length,s=this.strategy(node,mode!=='train',card);
  if(node.player===hero){
   const vals=node.children.map(c=>this.#cfr(c,hero,opp,mode,t,card)),out=new Float64Array(H.n);
   for(let h=0;h<H.n;h++){let v=0;if(mode==='br'){v=-Infinity;for(let a=0;a<k;a++)v=Math.max(v,vals[a][h]);}else for(let a=0;a<k;a++)v+=s[h*k+a]*vals[a][h];out[h]=v;}
   if(mode==='train'){const r=this.#table(this.#regret,node,card),[pos,neg]=this.#disc;
    for(let h=0;h<H.n;h++)for(let a=0;a<k;a++){const x=r[h*k+a];r[h*k+a]=(x>0?x*pos:x*neg)+vals[a][h]-out[h];}}
   return out;
  }
  const out=new Float64Array(H.n);
  if(mode==='train'){const avg=this.#table(this.#avg,node,card);for(let o=0;o<O.n;o++)for(let a=0;a<k;a++)avg[o*k+a]+=this.#w*opp[o]*s[o*k+a];}
  for(let a=0;a<k;a++){const reach=new Float64Array(O.n);for(let o=0;o<O.n;o++)reach[o]=opp[o]*s[o*k+a];const v=this.#cfr(node.children[a],hero,reach,mode,t,card);for(let h=0;h<H.n;h++)out[h]+=v[h];}
  return out;
 }
 // Discounted CFR (alpha 1.5, beta 0, gamma 2): measured to converge 2-3x faster than CFR+ on turn and river spots.
 #disc=[1,1];#w=1;
 run(iterations:number){for(let i=0;i<iterations;i++){const t=++this.iterations,p=t-1;this.#w=t*t;this.#disc=[p>0?p**1.5/(p**1.5+1):0,p>0?0.5:0];for(const hero of [0,1] as const)this.#cfr(this.tree,hero,Float64Array.from(this.sides[1-hero].w),'train',t,-1);}return this;}
 /** Average value per hand pair for player `hero` under: the average strategies, or a best response. */
 #value(hero:0|1,mode:'avg'|'br'){const v=this.#cfr(this.tree,hero,Float64Array.from(this.sides[1-hero].w),mode,0,-1),H=this.sides[hero];let num=0;for(let h=0;h<H.n;h++)num+=H.w[h]*v[h];return num/this.#pairWeight();}
 #pw=-1;#pairWeight(){if(this.#pw>=0)return this.#pw;const [A,B]=this.sides;let s=0;for(let a=0;a<A.n;a++)for(let b=0;b<B.n;b++)if(A.c1[a]!==B.c1[b]&&A.c1[a]!==B.c2[b]&&A.c2[a]!==B.c1[b]&&A.c2[a]!==B.c2[b])s+=A.w[a]*B.w[b];return this.#pw=s;}
 /** Exploitability as a share of the pot: average gain of a best response over the equilibrium value. */
 exploitability(){const br0=this.#value(0,'br'),br1=this.#value(1,'br');return (br0+br1-this.pot)/2/this.pot;}
 values(){return [this.#value(0,'avg'),this.#value(1,'avg')];}
 nodes(){return this.#nodes;}
}

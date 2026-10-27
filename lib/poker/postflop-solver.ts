/** Heads-up postflop solver (2026/10/26): exact discounted CFR over hand combos from the flop, turn or river.
 * No card abstraction: every turn and river card is solved separately. The only modelling choice is the
 * bet-size menu. Exploitability (what a perfect opponent could gain) is reported so every result carries
 * its own accuracy figure. Player 0 = out of position (acts first), player 1 = in position.
 */
import {evalCodes} from './fast-eval';

export type Combo={c1:number;c2:number;weight:number};
export type SolverSpot={board:number[];pot:number;stack:number;ranges:[Combo[],Combo[]];
 /** Sizes on the first street solved (fractions of the pot; raises are multiples of the bet faced). */
 betSizes:number[];raiseSizes:number[];maxRaises:number;
 /** Turn sizes when solving from the flop (default: the first street's). */
 turnBetSizes?:number[];turnRaiseSizes?:number[];turnMaxRaises?:number;
 /** River sizes when solving from an earlier street (default: the first street's). */
 riverBetSizes?:number[];riverRaiseSizes?:number[];riverMaxRaises?:number;
 /** Offer all-in only when it is at most this many times the pot (after calling). Default: always. Keeps deep-stack trees small. */
 allinMaxPot?:number};
export type Street='flop'|'turn'|'river';
export type Action={label:string;kind:'check'|'bet'|'call'|'fold'|'raise'|'allin';to:number};
export type ActNode={kind:'act';street:Street;player:0|1;actions:Action[];children:Node[];id:number;path:string;contrib:[number,number]};
/** A card is dealt; `child` is solved once per possible card (strategies are stored per dealt card). */
export type ChanceNode={kind:'chance';street:'turn'|'river';child:Node;contrib:[number,number]};
export type Node=ActNode|ChanceNode|{kind:'fold';folder:0|1;contrib:[number,number]}|{kind:'showdown';contrib:[number,number]};
type Sizes={bets:number[];raises:number[];maxRaises:number};
const NEXT={flop:'turn',turn:'river'} as const;

/** Dealt-card context: up to two cards dealt during the solve, as a*53+b (52 = none). */
export const NO_CARDS=52*53+52;
export const dealtCards=(ctx:number)=>[Math.floor(ctx/53),ctx%53].filter(c=>c<52);
export const dealCard=(ctx:number,card:number)=>Math.floor(ctx/53)===52?card*53+52:Math.floor(ctx/53)*53+card;

/** Bet tree. All amounts are chips put in during the solved streets; `stack` is what each player has behind at the start. */
export function buildTree(spot:Omit<SolverSpot,'board'|'ranges'>,street:Street='river'):Node{
 let id=0;
 const sizes=(s:Street):Sizes=>s===street?{bets:spot.betSizes,raises:spot.raiseSizes,maxRaises:spot.maxRaises}
  :s==='turn'?{bets:spot.turnBetSizes??spot.betSizes,raises:spot.turnRaiseSizes??spot.raiseSizes,maxRaises:spot.turnMaxRaises??spot.maxRaises}
  :{bets:spot.riverBetSizes??spot.betSizes,raises:spot.riverRaiseSizes??spot.raiseSizes,maxRaises:spot.riverMaxRaises??spot.maxRaises};
 const copy=(c:[number,number])=>[...c] as [number,number];
 const round=(v:number)=>Math.round(v*100)/100;
 // Betting closed: deal the next card, or show down. All-in: deal the remaining cards, then show down.
 const close=(s:Street,c:[number,number],allIn:boolean,path:string):Node=>{
  if(s==='river')return {kind:'showdown',contrib:copy(c)};
  const next=NEXT[s];
  if(allIn){let n:Node={kind:'showdown',contrib:copy(c)};if(next==='turn')n={kind:'chance',street:'river',child:n,contrib:copy(c)};return {kind:'chance',street:next,child:n,contrib:copy(c)};}
  return {kind:'chance',street:next,contrib:copy(c),child:make(next,0,c,0,0,false,path+'|')};
 };
 const make=(s:Street,player:0|1,contrib:[number,number],facing:number,raises:number,checked:boolean,path:string):Node=>{
  const actions:Action[]=[],children:Node[]=[];const other=(1-player) as 0|1,sz=sizes(s);
  const add=(a:Action,child:()=>Node)=>{if(!actions.some(x=>x.to===a.to&&x.kind===a.kind)){actions.push(a);children.push(child());}};
  const potNow=spot.pot+contrib[0]+contrib[1],base=contrib[player];
  if(facing===0){
   add({label:'チェック',kind:'check',to:base},()=>checked||player===1?close(s,contrib,false,path+'x'):make(s,other,contrib,0,raises,true,path+'x'));
   for(const f of sz.bets){const to=Math.min(spot.stack,round(base+f*potNow));if(to<=base)continue;const c=copy(contrib);c[player]=to;
    add({label:to>=spot.stack?'オールイン':`ベット ${Math.round(f*100)}%`,kind:to>=spot.stack?'allin':'bet',to},()=>make(s,other,c,to,raises,false,path+'b'+to));}
   if(base<spot.stack&&spot.stack-base<=(spot.allinMaxPot??Infinity)*potNow){const c=copy(contrib);c[player]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},()=>make(s,other,c,spot.stack,raises,false,path+'a'));}
  }else{
   add({label:'フォールド',kind:'fold',to:base},()=>({kind:'fold',folder:player,contrib:copy(contrib)}));
   const callC=copy(contrib);callC[player]=facing;
   add({label:'コール',kind:'call',to:facing},()=>close(s,callC,facing>=spot.stack,path+'c'));
   if(raises<sz.maxRaises&&facing<spot.stack){
    for(const m of sz.raises){const to=Math.min(spot.stack,round(base+m*(facing-base)));if(to<=facing)continue;const c=copy(contrib);c[player]=to;
     add({label:to>=spot.stack?'オールイン':`レイズ ${m}倍`,kind:to>=spot.stack?'allin':'raise',to},()=>make(s,other,c,to,raises+1,false,path+'r'+to));}
    if(spot.stack-base<=(spot.allinMaxPot??Infinity)*(potNow+facing-base)){const c=copy(contrib);c[player]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},()=>make(s,other,c,spot.stack,raises+1,false,path+'a'));}
   }
  }
  return {kind:'act',street:s,player,actions,children,id:id++,path,contrib:copy(contrib)};
 };
 return make(street,0,[0,0],0,0,false,'');
}

/** Per player: combos and, per card, the combos holding it. */
type Side={c1:Int32Array;c2:Int32Array;w:Float64Array;n:number;keyIndex:Map<number,number>;byCard:Int32Array[]};
function prepare(board:number[],combos:Combo[]):Side{
 const used=new Set(board),seen=new Set<number>();
 const list=combos.filter(c=>{const k=Math.min(c.c1,c.c2)*52+Math.max(c.c1,c.c2);if(c.weight<=0||c.c1===c.c2||used.has(c.c1)||used.has(c.c2)||seen.has(k))return false;seen.add(k);return true;});
 const n=list.length,c1=new Int32Array(n),c2=new Int32Array(n),w=new Float64Array(n),keyIndex=new Map<number,number>();
 list.forEach((c,i)=>{c1[i]=c.c1;c2[i]=c.c2;w[i]=c.weight;keyIndex.set(Math.min(c.c1,c.c2)*52+Math.max(c.c1,c.c2),i);});
 const byCard:Int32Array[]=[];
 for(let c=0;c<52;c++){const ids:number[]=[];for(let i=0;i<n;i++)if(c1[i]===c||c2[i]===c)ids.push(i);byCard[c]=Int32Array.from(ids);}
 return {c1,c2,w,n,keyIndex,byCard};
}
type Showdown={strength:[Float64Array,Float64Array];order:[Int32Array,Int32Array]};

export class PostflopSolver{
 readonly tree:Node;readonly sides:[Side,Side];readonly pot:number;readonly street:Street;
 /** Cards not on the starting board (the turn/river cards that can come). */
 readonly deck:number[];
 /** Kept for existing callers: the possible river cards of a turn solve (empty otherwise). */
 readonly riverCards:number[];
 #same:[Int32Array,Int32Array];#cards=new Float64Array(52);#reach:Float64Array;#showdowns:(Showdown|undefined)[]=new Array(2809);#dealable:(number[]|undefined)[]=new Array(2809);
 #regret:(Float32Array|undefined)[]=[];#avg:(Float32Array|undefined)[]=[];#tables=0;#nodes:ActNode[]=[];
 iterations=0;
 constructor(readonly spot:SolverSpot){
  if(spot.board.length<3||spot.board.length>5)throw new Error('board must have 3 to 5 cards');
  this.street=spot.board.length===3?'flop':spot.board.length===4?'turn':'river';this.pot=spot.pot;
  this.deck=[...Array(52).keys()].filter(c=>!spot.board.includes(c));
  this.riverCards=this.street==='turn'?this.deck:[];
  this.tree=buildTree(spot,this.street);
  this.sides=[prepare(spot.board,spot.ranges[0]),prepare(spot.board,spot.ranges[1])];
  const sameOf=(H:Side,O:Side)=>{const r=new Int32Array(H.n);for(let h=0;h<H.n;h++)r[h]=O.keyIndex.get(Math.min(H.c1[h],H.c2[h])*52+Math.max(H.c1[h],H.c2[h]))??-1;return r;};
  this.#same=[sameOf(this.sides[0],this.sides[1]),sameOf(this.sides[1],this.sides[0])];this.#reach=new Float64Array(Math.max(this.sides[0].n,this.sides[1].n));
  const walk=(n:Node)=>{if(n.kind==='act'){this.#nodes.push(n);n.children.forEach(walk);}else if(n.kind==='chance')walk(n.child);};walk(this.tree);
  this.#width=Math.max(1,this.sides[0].n,this.sides[1].n)*Math.max(1,...this.#nodes.map(x=>x.actions.length));
 }
 /** Cards that can be dealt next in a dealt-card context. */
 dealable(ctx:number){let c=this.#dealable[ctx];if(!c){const d=dealtCards(ctx);c=this.#dealable[ctx]=this.deck.filter(x=>!d.includes(x));}return c;}
 /** Hand strengths for the final board reached by `ctx` (cached; the two dealt cards are unordered). */
 #showdown(ctx:number):Showdown{
  let s=this.#showdowns[ctx];if(s)return s;
  const d=dealtCards(ctx).sort((a,b)=>a-b),key=(d[0]??52)*53+(d[1]??52);s=this.#showdowns[key];if(s)return this.#showdowns[ctx]=s;
  const board=[...this.spot.board,...d];
  const one=(S:Side)=>{const st=new Float64Array(S.n);for(let i=0;i<S.n;i++)st[i]=board.includes(S.c1[i])||board.includes(S.c2[i])?-1:evalCodes([S.c1[i],S.c2[i],...board]);
   return [st,Int32Array.from([...Array(S.n).keys()].sort((a,b)=>st[a]-st[b]))] as const;};
  const [a,b]=[one(this.sides[0]),one(this.sides[1])];s={strength:[a[0],b[0]],order:[a[1],b[1]]};this.#showdowns[key]=s;this.#showdowns[ctx]=s;return s;
 }
 #table(map:(Float32Array|undefined)[],node:ActNode,ctx:number){const key=node.id*2809+ctx;let t=map[key];if(!t){t=map[key]=new Float32Array(this.sides[node.player].n*node.actions.length);this.#tables++;}return t;}
 /** Current (regret-matching) or average strategy for one node: [combo*k + action]. `ctx` = the cards dealt on the way (see dealCard). */
 strategy(node:ActNode,average=false,ctx=NO_CARDS){
  const k=node.actions.length,n=this.sides[node.player].n,src=this.#table(average?this.#avg:this.#regret,node,ctx),out=new Float64Array(n*k);
  for(let h=0;h<n;h++){let sum=0;for(let a=0;a<k;a++)sum+=Math.max(0,src[h*k+a]);for(let a=0;a<k;a++)out[h*k+a]=sum>0?Math.max(0,src[h*k+a])/sum:1/k;}
  return out;
 }
 // Scratch buffers used as a stack: every #cfr call takes its output first, then frees its own temporaries on return
 // (allocating typed arrays per visit dominated the run time on flop trees).
 #buf:Float64Array[]=[];#top=0;#width=0;
 #alloc(){let b=this.#buf[this.#top];if(!b){b=this.#buf[this.#top]=new Float64Array(this.#width);}this.#top++;return b;}
 /** Current strategy into a scratch buffer: [combo*k + action]. */
 #strat(node:ActNode,average:boolean,ctx:number){
  const k=node.actions.length,n=this.sides[node.player].n,src=this.#table(average?this.#avg:this.#regret,node,ctx),out=this.#alloc();
  for(let h=0;h<n;h++){let sum=0;const o=h*k;for(let a=0;a<k;a++){const x=src[o+a];if(x>0)sum+=x;}
   if(sum>0)for(let a=0;a<k;a++){const x=src[o+a];out[o+a]=x>0?x/sum:0;}else for(let a=0;a<k;a++)out[o+a]=1/k;}
  return out;
 }
 /** Values for every hero combo at a terminal, against opponent reach, with exact card removal. */
 #terminal(node:Extract<Node,{kind:'fold'|'showdown'}>,hero:0|1,opp:Float64Array,ctx:number,out:Float64Array){
  const H=this.sides[hero],O=this.sides[1-hero],hn=H.n,on=O.n,hc1=H.c1,hc2=H.c2,oc1=O.c1,oc2=O.c2,same=this.#same[hero];
  const me=node.contrib[hero],them=node.contrib[1-hero],all=this.#cards;all.fill(0);
  let total=0;for(let o=0;o<on;o++){const r=opp[o];if(r===0)continue;total+=r;all[oc1[o]]+=r;all[oc2[o]]+=r;}
  // reach[h] = opponent reach not sharing a card with h (inclusion-exclusion: the identical combo was subtracted twice).
  const reach=this.#reach;for(let h=0;h<hn;h++){const x=same[h];reach[h]=total-all[hc1[h]]-all[hc2[h]]+(x>=0?opp[x]:0);}
  if(node.kind==='fold'){const pay=node.folder===hero?-me:this.pot+them;for(let h=0;h<hn;h++)out[h]=pay*reach[h];return;}
  const sd=this.#showdown(ctx),HS=sd.strength[hero],OS=sd.strength[1-hero],HO=sd.order[hero],OO=sd.order[1-hero];
  const win=this.pot+them,lose=-me,tie=this.pot/2,cs=this.#cards;
  // Sweep both lists by strength: reach strictly below (wins) then strictly above (losses), minus blocked combos.
  cs.fill(0);let sum=0,j=0;
  for(let x=0;x<hn;x++){const h=HO[x],hs=HS[h];while(j<on&&OS[OO[j]]<hs){const o=OO[j++],r=opp[o];if(r!==0){sum+=r;cs[oc1[o]]+=r;cs[oc2[o]]+=r;}}const below=sum-cs[hc1[h]]-cs[hc2[h]];out[h]=below*(win-tie)+reach[h]*tie;}
  cs.fill(0);sum=0;j=on-1;
  for(let x=hn-1;x>=0;x--){const h=HO[x],hs=HS[h];while(j>=0&&OS[OO[j]]>hs){const o=OO[j--],r=opp[o];if(r!==0){sum+=r;cs[oc1[o]]+=r;cs[oc2[o]]+=r;}}out[h]+=(sum-cs[hc1[h]]-cs[hc2[h]])*(lose-tie);}
 }
 /** Hero values at `node` given opponent reach `opp`. The returned buffer stays valid until the caller's frame is freed. */
 #cfr(node:Node,hero:0|1,opp:Float64Array,mode:'train'|'br'|'avg',ctx:number):Float64Array{
  const mark=this.#top,out=this.#alloc(),H=this.sides[hero],O=this.sides[1-hero],hn=H.n,on=O.n;
  if(node.kind==='fold'||node.kind==='showdown'){this.#terminal(node,hero,opp,ctx,out);return out;}
  if(node.kind==='chance'){
   // Every valid (hero, opponent) pair leaves exactly (cards left - 4) possible cards, so each card weighs 1/(cards left - 4).
   const cards=this.dealable(ctx),div=cards.length-4,o2=this.#alloc();out.fill(0,0,hn);
   for(const c of cards){
    o2.set(opp.subarray(0,on));for(const o of O.byCard[c])o2[o]=0;
    const inner=this.#top,v=this.#cfr(node.child,hero,o2,mode,dealCard(ctx,c));for(const h of H.byCard[c])v[h]=0;
    for(let h=0;h<hn;h++)out[h]+=v[h];
    this.#top=inner;
   }
   for(let h=0;h<hn;h++)out[h]/=div;
   this.#top=mark+1;return out;
  }
  const k=node.actions.length,s=this.#strat(node,mode!=='train',ctx);
  if(node.player===hero){
   const vals:Float64Array[]=[];for(let a=0;a<k;a++)vals.push(this.#cfr(node.children[a],hero,opp,mode,ctx));
   for(let h=0;h<hn;h++){let v=0;if(mode==='br'){v=-Infinity;for(let a=0;a<k;a++)v=Math.max(v,vals[a][h]);}else for(let a=0;a<k;a++)v+=s[h*k+a]*vals[a][h];out[h]=v;}
   if(mode==='train'){const r=this.#table(this.#regret,node,ctx),[pos,neg]=this.#disc;
    for(let h=0;h<hn;h++){const o=h*k,v=out[h];for(let a=0;a<k;a++){const x=r[o+a];r[o+a]=(x>0?x*pos:x*neg)+vals[a][h]-v;}}}
   this.#top=mark+1;return out;
  }
  if(mode==='train'){const avg=this.#table(this.#avg,node,ctx),w=this.#w;for(let o=0;o<on;o++){const r=opp[o]*w;if(r===0)continue;for(let a=0;a<k;a++)avg[o*k+a]+=r*s[o*k+a];}}
  out.fill(0,0,hn);const reach=this.#alloc();
  for(let a=0;a<k;a++){
   let any=false;for(let o=0;o<on;o++){const r=opp[o]*s[o*k+a];reach[o]=r;if(r!==0)any=true;}
   if(!any)continue; // nobody reaches this branch: it adds nothing
   const inner=this.#top,v=this.#cfr(node.children[a],hero,reach,mode,ctx);for(let h=0;h<hn;h++)out[h]+=v[h];this.#top=inner;
  }
  this.#top=mark+1;return out;
 }
 // Discounted CFR (alpha 1.5, beta 0, gamma 2): measured to converge 2-3x faster than CFR+ on turn and river spots.
 #disc=[1,1];#w=1;
 run(iterations:number){for(let i=0;i<iterations;i++){const t=++this.iterations,p=t-1;this.#w=t*t;this.#disc=[p>0?p**1.5/(p**1.5+1):0,p>0?0.5:0];for(const hero of [0,1] as const){this.#top=0;this.#cfr(this.tree,hero,Float64Array.from(this.sides[1-hero].w),'train',NO_CARDS);}}return this;}
 /** Average value per hand pair for player `hero` under: the average strategies, or a best response. */
 #value(hero:0|1,mode:'avg'|'br'){this.#top=0;const v=this.#cfr(this.tree,hero,Float64Array.from(this.sides[1-hero].w),mode,NO_CARDS),H=this.sides[hero];let num=0;for(let h=0;h<H.n;h++)num+=H.w[h]*v[h];return num/this.#pairWeight();}
 #pw=-1;#pairWeight(){if(this.#pw>=0)return this.#pw;const [A,B]=this.sides;let s=0;for(let a=0;a<A.n;a++)for(let b=0;b<B.n;b++)if(A.c1[a]!==B.c1[b]&&A.c1[a]!==B.c2[b]&&A.c2[a]!==B.c1[b]&&A.c2[a]!==B.c2[b])s+=A.w[a]*B.w[b];return this.#pw=s;}
 /** Exploitability as a share of the pot: average gain of a best response over the equilibrium value. */
 exploitability(){const br0=this.#value(0,'br'),br1=this.#value(1,'br');return (br0+br1-this.pot)/2/this.pot;}
 values(){return [this.#value(0,'avg'),this.#value(1,'avg')];}
 nodes(){return this.#nodes;}
 /** Number of strategy tables in use (memory gauge). */
 tableCount(){return this.#tables;}
}

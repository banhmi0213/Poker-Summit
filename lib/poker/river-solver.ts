/** Heads-up river solver (2026/10/26): exact CFR+ over hand combos for a fixed board, pot and stack.
 * No abstraction of cards; the only modelling choice is the bet-size menu. Reports exploitability
 * (how much a perfect opponent could gain), so every result carries its own accuracy figure.
 * Player 0 = out of position (acts first), player 1 = in position.
 */
import {evalCodes} from './fast-eval';

export type Combo={c1:number;c2:number;weight:number};
export type SolverSpot={board:number[];pot:number;stack:number;ranges:[Combo[],Combo[]];betSizes:number[];raiseSizes:number[];maxRaises:number};
type Action={label:string;kind:'check'|'bet'|'call'|'fold'|'raise'|'allin';to:number};
export type Node={kind:'act';player:0|1;actions:Action[];children:Node[];id:number;path:string;contrib:[number,number]}
 |{kind:'fold';folder:0|1;contrib:[number,number]}|{kind:'showdown';contrib:[number,number]};

/** Bet tree: sizes are fractions of the current pot; raises are multiples of the bet faced; all-in always offered. */
export function buildTree(spot:Pick<SolverSpot,'pot'|'stack'|'betSizes'|'raiseSizes'|'maxRaises'>):Node{
 let id=0;
 const make=(player:0|1,contrib:[number,number],facing:number,raises:number,checked:boolean,path:string):Node=>{
  const actions:Action[]=[],children:Node[]=[];const other=(1-player) as 0|1;
  const add=(a:Action,child:Node)=>{if(!actions.some(x=>x.to===a.to&&x.kind===a.kind)){actions.push(a);children.push(child);}};
  const potNow=spot.pot+contrib[0]+contrib[1];
  if(facing===0){
   add({label:'チェック',kind:'check',to:contrib[player]},checked||player===1?{kind:'showdown',contrib:[...contrib] as [number,number]}:make(other,contrib,0,raises,true,path+'x'));
   for(const f of spot.betSizes){const to=Math.min(spot.stack,Math.round(f*potNow*100)/100);if(to<=0)continue;const c=[...contrib] as [number,number];c[player]=to;
    add({label:to>=spot.stack?'オールイン':`ベット ${Math.round(f*100)}%`,kind:to>=spot.stack?'allin':'bet',to},make(other,c,to,raises,false,path+'b'+to));}
   if(!spot.betSizes.length||Math.min(...spot.betSizes)*potNow<spot.stack){const c=[...contrib] as [number,number];c[player]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},make(other,c,spot.stack,raises,false,path+'a'));}
  }else{
   add({label:'フォールド',kind:'fold',to:contrib[player]},{kind:'fold',folder:player,contrib:[...contrib] as [number,number]});
   const callC=[...contrib] as [number,number];callC[player]=facing;
   add({label:'コール',kind:'call',to:facing},{kind:'showdown',contrib:callC});
   if(raises<spot.maxRaises&&facing<spot.stack){
    for(const m of spot.raiseSizes){const to=Math.min(spot.stack,Math.round(m*facing*100)/100);if(to<=facing)continue;const c=[...contrib] as [number,number];c[player]=to;
     add({label:to>=spot.stack?'オールイン':`レイズ ${m}倍`,kind:to>=spot.stack?'allin':'raise',to},make(other,c,to,raises+1,false,path+'r'+to));}
    const c=[...contrib] as [number,number];c[player]=spot.stack;add({label:'オールイン',kind:'allin',to:spot.stack},make(other,c,spot.stack,raises+1,false,path+'a'));
   }
  }
  return {kind:'act',player,actions,children,id:id++,path,contrib:[...contrib] as [number,number]};
 };
 return make(0,[0,0],0,0,false,'');
}

type Side={c1:Int32Array;c2:Int32Array;w:Float64Array;strength:Float64Array;order:Int32Array;n:number;keyIndex:Map<number,number>};
function prepare(board:number[],combos:Combo[]):Side{
 const used=new Set(board);const list=combos.filter(c=>c.weight>0&&c.c1!==c.c2&&!used.has(c.c1)&&!used.has(c.c2));
 const n=list.length,c1=new Int32Array(n),c2=new Int32Array(n),w=new Float64Array(n),strength=new Float64Array(n),keyIndex=new Map<number,number>();
 list.forEach((c,i)=>{c1[i]=c.c1;c2[i]=c.c2;w[i]=c.weight;strength[i]=evalCodes([c.c1,c.c2,...board]);keyIndex.set(Math.min(c.c1,c.c2)*52+Math.max(c.c1,c.c2),i);});
 const order=Int32Array.from([...Array(n).keys()].sort((a,b)=>strength[a]-strength[b]));
 return {c1,c2,w,strength,order,n,keyIndex};
}

export class RiverSolver{
 readonly tree:Node;readonly sides:[Side,Side];readonly pot:number;
 #regret=new Map<number,Float64Array>();#avg=new Map<number,Float64Array>();#nodes:Extract<Node,{kind:'act'}>[]=[];
 iterations=0;
 constructor(readonly spot:SolverSpot){
  this.pot=spot.pot;this.tree=buildTree(spot);this.sides=[prepare(spot.board,spot.ranges[0]),prepare(spot.board,spot.ranges[1])];
  const walk=(n:Node)=>{if(n.kind!=='act')return;this.#nodes.push(n);const size=this.sides[n.player].n*n.actions.length;this.#regret.set(n.id,new Float64Array(size));this.#avg.set(n.id,new Float64Array(size));n.children.forEach(walk);};walk(this.tree);
 }
 /** Current (regret-matching) or average strategy for one node: [combo*k + action]. */
 strategy(node:Extract<Node,{kind:'act'}>,average=false){
  const k=node.actions.length,n=this.sides[node.player].n,src=(average?this.#avg:this.#regret).get(node.id)!,out=new Float64Array(n*k);
  for(let h=0;h<n;h++){let sum=0;for(let a=0;a<k;a++)sum+=Math.max(0,src[h*k+a]);for(let a=0;a<k;a++)out[h*k+a]=sum>0?Math.max(0,src[h*k+a])/sum:1/k;}
  return out;
 }
 /** Values for every hero combo at a terminal, against opponent reach, with exact card removal. */
 #terminal(node:Exclude<Node,{kind:'act'}>,hero:0|1,opp:Float64Array):Float64Array{
  const H=this.sides[hero],O=this.sides[1-hero],out=new Float64Array(H.n),me=node.contrib[hero],them=node.contrib[1-hero];
  if(node.kind==='fold'){
   const pay=node.folder===hero?-me:this.pot+them;let total=0;const card=new Float64Array(52);
   for(let o=0;o<O.n;o++){total+=opp[o];card[O.c1[o]]+=opp[o];card[O.c2[o]]+=opp[o];}
   for(let h=0;h<H.n;h++){const same=O.keyIndex.get(Math.min(H.c1[h],H.c2[h])*52+Math.max(H.c1[h],H.c2[h]));out[h]=pay*(total-card[H.c1[h]]-card[H.c2[h]]+(same!==undefined?opp[same]:0));}
   return out;
  }
  const win=this.pot+them,lose=-me,tie=this.pot/2;
  // Sweep both lists by strength: reach strictly below (wins) and strictly above (losses), minus blocked combos.
  const below=new Float64Array(H.n),above=new Float64Array(H.n),card=new Float64Array(52);let sum=0,j=0;
  for(let x=0;x<H.n;x++){const h=H.order[x];while(j<O.n&&O.strength[O.order[j]]<H.strength[h]){const o=O.order[j++];sum+=opp[o];card[O.c1[o]]+=opp[o];card[O.c2[o]]+=opp[o];}below[h]=sum-card[H.c1[h]]-card[H.c2[h]];}
  card.fill(0);sum=0;j=O.n-1;
  for(let x=H.n-1;x>=0;x--){const h=H.order[x];while(j>=0&&O.strength[O.order[j]]>H.strength[h]){const o=O.order[j--];sum+=opp[o];card[O.c1[o]]+=opp[o];card[O.c2[o]]+=opp[o];}above[h]=sum-card[H.c1[h]]-card[H.c2[h]];}
  let total=0;const all=new Float64Array(52);for(let o=0;o<O.n;o++){total+=opp[o];all[O.c1[o]]+=opp[o];all[O.c2[o]]+=opp[o];}
  for(let h=0;h<H.n;h++){const same=O.keyIndex.get(Math.min(H.c1[h],H.c2[h])*52+Math.max(H.c1[h],H.c2[h]));const reach=total-all[H.c1[h]]-all[H.c2[h]]+(same!==undefined?opp[same]:0);const ties=reach-below[h]-above[h];out[h]=below[h]*win+above[h]*lose+ties*tie;}
  return out;
 }
 #cfr(node:Node,hero:0|1,opp:Float64Array,mode:'train'|'br'|'avg',t:number):Float64Array{
  if(node.kind!=='act')return this.#terminal(node,hero,opp);
  const k=node.actions.length,useAvg=mode!=='train',s=this.strategy(node,useAvg);
  if(node.player===hero){
   const n=this.sides[hero].n,vals=node.children.map(c=>this.#cfr(c,hero,opp,mode,t)),out=new Float64Array(n);
   for(let h=0;h<n;h++){let v=0;if(mode==='br'){v=-Infinity;for(let a=0;a<k;a++)v=Math.max(v,vals[a][h]);}else for(let a=0;a<k;a++)v+=s[h*k+a]*vals[a][h];out[h]=v;}
   if(mode==='train'){const r=this.#regret.get(node.id)!;for(let h=0;h<n;h++)for(let a=0;a<k;a++)r[h*k+a]=Math.max(0,r[h*k+a]+vals[a][h]-out[h]);}
   return out;
  }
  const n=this.sides[node.player].n,out=new Float64Array(this.sides[hero].n);
  if(mode==='train'){const avg=this.#avg.get(node.id)!;for(let o=0;o<n;o++)for(let a=0;a<k;a++)avg[o*k+a]+=t*opp[o]*s[o*k+a];}
  for(let a=0;a<k;a++){const reach=new Float64Array(n);for(let o=0;o<n;o++)reach[o]=opp[o]*s[o*k+a];const v=this.#cfr(node.children[a],hero,reach,mode,t);for(let h=0;h<out.length;h++)out[h]+=v[h];}
  return out;
 }
 run(iterations:number){for(let i=0;i<iterations;i++){const t=++this.iterations;for(const hero of [0,1] as const)this.#cfr(this.tree,hero,Float64Array.from(this.sides[1-hero].w),'train',t);}return this;}
 /** Average value per hand pair for player `hero` under: the average strategies, or a best response. */
 #value(hero:0|1,mode:'avg'|'br'){const v=this.#cfr(this.tree,hero,Float64Array.from(this.sides[1-hero].w),mode,0),H=this.sides[hero];let num=0;for(let h=0;h<H.n;h++)num+=H.w[h]*v[h];return num/this.#pairWeight();}
 #pw=-1;#pairWeight(){if(this.#pw>=0)return this.#pw;const [A,B]=this.sides;let s=0;for(let a=0;a<A.n;a++)for(let b=0;b<B.n;b++)if(A.c1[a]!==B.c1[b]&&A.c1[a]!==B.c2[b]&&A.c2[a]!==B.c1[b]&&A.c2[a]!==B.c2[b])s+=A.w[a]*B.w[b];return this.#pw=s;}
 /** Exploitability as a share of the pot: average gain of a best response over the equilibrium value. */
 exploitability(){const br0=this.#value(0,'br'),br1=this.#value(1,'br');return (br0+br1-this.pot)/2/this.pot;}
 values(){return [this.#value(0,'avg'),this.#value(1,'avg')];}
 nodes(){return this.#nodes;}
}

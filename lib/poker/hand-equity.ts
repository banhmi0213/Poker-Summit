import {evalCodes} from './fast-eval';

/** Hand-vs-hand equity calculator (owner 2026/11/1「勝率計算・ポットオッズ」).
 * Cards are codes (rank-2)*4 + suit (c,d,h,s), as fast-eval. Exact when the remaining runouts are few (flop and
 * later, or few unknown cards); otherwise a seeded Monte Carlo, so the same input always shows the same numbers. */
export type HandEquity={win:number;tie:number;equity:number;made:number[]};
export type EquityRun={hands:HandEquity[];samples:number;exact:boolean};

/** Final-hand classes shown in the table, strongest first. */
export const MADE_NAMES=['ロイヤルフラッシュ','ストレートフラッシュ','フォーカード','フルハウス','フラッシュ','ストレート','スリーカード','ツーペア','ワンペア','ハイカード'] as const;
const CAT=13**5;
/** Index into MADE_NAMES for an evalCodes value. */
export function madeIndex(v:number){const cat=Math.floor(v/CAT);if(cat===8)return Math.floor(v/13**4)%13===12?0:1;return 9-cat;}

function mulberry(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const choose=(n:number,k:number)=>{let r=1;for(let i=0;i<k;i++)r=r*(n-i)/(i+1);return Math.round(r);};

/** hands: 2+ hands of 2 cards; board: 0..5 cards. Throws on duplicate cards. */
export function handEquity(hands:number[][],board:number[],maxExact=200000,samples=40000):EquityRun{
 const used=[...hands.flat(),...board];
 if(hands.length<2||hands.some(h=>h.length!==2)||board.length>5)throw Error('bad input');
 if(new Set(used).size!==used.length||used.some(c=>c<0||c>51))throw Error('duplicate card');
 const deck:number[]=[];for(let c=0;c<52;c++)if(!used.includes(c))deck.push(c);
 const need=5-board.length,n=hands.length;
 const win=new Array(n).fill(0),tie=new Array(n).fill(0),share=new Array(n).fill(0),made=hands.map(()=>new Array(MADE_NAMES.length).fill(0));
 const vals=new Array(n).fill(0),full=board.slice();
 const score=(extra:number[])=>{
  let best=-1,count=0;
  for(let i=0;i<n;i++){const v=evalCodes([hands[i][0],hands[i][1],...full,...extra]);vals[i]=v;made[i][madeIndex(v)]++;if(v>best){best=v;count=1;}else if(v===best)count++;}
  for(let i=0;i<n;i++)if(vals[i]===best){share[i]+=1/count;if(count===1)win[i]++;else tie[i]++;}
 };
 const total=choose(deck.length,need),exact=total<=maxExact;let runs=0;
 if(exact){
  const pick:number[]=[];
  const rec=(from:number)=>{if(pick.length===need){score(pick);runs++;return;}for(let i=from;i<=deck.length-(need-pick.length);i++){pick.push(deck[i]);rec(i+1);pick.pop();}};
  rec(0);
 }else{
  const rnd=mulberry(used.reduce((s,c)=>s*53+c+1,7)>>>0),d=deck.slice();
  for(;runs<samples;runs++){
   for(let k=0;k<need;k++){const j=k+Math.floor(rnd()*(d.length-k));const t=d[k];d[k]=d[j];d[j]=t;}
   score(d.slice(0,need));
  }
 }
 return {exact,samples:runs,hands:hands.map((_,i)=>({win:win[i]/runs,tie:tie[i]/runs,equity:share[i]/runs,made:made[i].map(x=>x/runs)}))};
}

/** Pot odds: share of the final pot a call must win to break even, and the call's expected value (same unit as the
 * inputs). pot = the pot before the bet, bet = the bet you face, call = what you put in (usually the bet). */
export function potOdds(pot:number,bet:number,call:number,equity:number){
 const final=pot+bet+call,required=final>0?call/final:0;
 return {final,required,ev:equity*final-call};
}

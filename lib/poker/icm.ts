/** ICM for tournaments (2026/10/30).
 * - icmEquity: Malmuth-Harville prize equity of every stack (exact over subsets, fine up to ~12 players).
 * - icmPushFold: short-stack push/fold equilibrium with prizes. Players act in order (UTG … BTN, SB, BB); the first
 *   player may move all in or fold; after an all-in each later player calls or folds, the first call goes to showdown
 *   (heads-up). Every outcome is valued by ICM (prize equity) instead of chips. Solved by fictitious play over the 169
 *   starting-hand classes with card removal between the two players in the pot.
 *   Chips are counted in big blinds: the small blind posts 0.5, the big blind 1 plus the ante (big blind ante, dead).
 */

/** Prize equity of each stack (same order as `stacks`); stacks of 0 are already out (they get nothing more). */
export function icmEquity(stacks:readonly number[],payouts:readonly number[]):number[]{
 const n=stacks.length,places=Math.min(payouts.length,n),out=new Array(n).fill(0);
 const memo=new Map<number,number[]>();
 // probs(mask) = for the players still in `mask`, the chance each one finishes in the best place still open.
 const rec=(mask:number,place:number):number[]=>{
  const key=mask*16+place;const hit=memo.get(key);if(hit)return hit;
  const res=new Array(n).fill(0);
  if(place>=places||mask===0){memo.set(key,res);return res;}
  let total=0;for(let i=0;i<n;i++)if(mask>>i&1)total+=stacks[i];
  if(total<=0){memo.set(key,res);return res;}
  for(let i=0;i<n;i++){if(!(mask>>i&1)||stacks[i]<=0)continue;const p=stacks[i]/total;res[i]+=p*payouts[place];
   const sub=rec(mask&~(1<<i),place+1);for(let j=0;j<n;j++)res[j]+=p*sub[j];}
  memo.set(key,res);return res;
 };
 let mask=0;for(let i=0;i<n;i++)if(stacks[i]>0)mask|=1<<i;
 const r=rec(mask,0);for(let i=0;i<n;i++)out[i]=r[i];
 return out;
}

export type IcmPlayer={pos:string;stack:number};
export type IcmSpot={players:IcmPlayer[];ante:number;payouts:number[];
 /** Stacks of players at other tables (they don't act here but share the prizes). */
 others?:number[];
 /** Chip EV instead of ICM (for comparison): each player's value is his stack. */
 chipEv?:boolean;iterations?:number};
export type Equity={labels:string[];eq:number[][]};
export type IcmResult={labels:string[];
 /** jam[k][hand] = how often player k moves all in when everyone before folded. */
 jam:number[][];
 /** call[k][q][hand] = how often player q calls player k's all-in (q after k). */
 call:(number[]|null)[][];
 jamPct:number[];callPct:(number|null)[][];
 /** Prize equity of every player before the hand (what folding everything is worth) and the field's prizes. */
 equityBefore:number[];iterations:number};

export function icmPushFold(spot:IcmSpot,equity:Equity):IcmResult{
 const P=spot.players.length,L=equity.labels,n=L.length,iters=spot.iterations??400;
 if(P<2)throw new Error('2人以上が必要です');
 const R='23456789TJQKA';
 const cards=L.map(l=>{const a=R.indexOf(l[0]),b=R.indexOf(l[1]),out:[number,number][]=[];for(let x=0;x<4;x++)for(let y=0;y<4;y++){if(a===b&&y<=x)continue;if(l[2]==='s'&&x!==y)continue;if(l[2]==='o'&&x===y)continue;out.push([a*4+x,b*4+y]);}return out;});
 const combos=cards.map(c=>c.length),prior=combos.map(c=>c/1326);
 // w[i*n+j]: compatible combo pairs; eq[i*n+j]: all-in equity of i against j.
 const w=new Float64Array(n*n),eq=new Float64Array(n*n);
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){let k=0;for(const [p,q] of cards[i])for(const [r,s] of cards[j])if(p!==r&&p!==s&&q!==r&&q!==s)k++;w[i*n+j]=k;eq[i*n+j]=equity.eq[i][j]/10000;}
 const others=spot.others??[];
 const value=(stacks:number[])=>spot.chipEv?stacks.slice(0,P):icmEquity([...stacks,...others],spot.payouts).slice(0,P);
 // Posts: SB 0.5, BB 1 + ante (dead). With two players the button is the small blind.
 const sbI=P===2?0:P-2,bbI=P-1,S=spot.players.map(p=>p.stack);
 const posted=S.map((_,i)=>i===sbI?Math.min(0.5,S[i]):i===bbI?Math.min(1,Math.max(0,S[i]-spot.ante)):0);
 const anteOf=(i:number)=>i===bbI?Math.min(spot.ante,S[i]):0;
 const dead=(i:number,a:number,b:number)=>i===a||i===b?0:posted[i]+anteOf(i);
 // Final stacks for each outcome (fixed per pair, independent of the cards).
 const steal:number[][]=[],win:number[][][]=[],lose:number[][][]=[];
 for(let k=0;k<P;k++){
  const st=S.map((s,i)=>s-posted[i]-anteOf(i));let pot=0;for(let i=0;i<P;i++)pot+=posted[i]+anteOf(i);st[k]+=pot;steal.push(value(st));
  win.push([]);lose.push([]);
  for(let q=0;q<P;q++){if(q<=k){win[k].push([]);lose[k].push([]);continue;}
   const live=(i:number)=>S[i]-anteOf(i),risk=Math.min(live(k),live(q));
   let deadPot=0;for(let i=0;i<P;i++)deadPot+=dead(i,k,q);
   const base=S.map((s,i)=>i===k||i===q?s-anteOf(i)-risk:s-posted[i]-anteOf(i)),total=2*risk+deadPot+anteOf(k)+anteOf(q);
   const a=[...base];a[k]+=total;const b=[...base];b[q]+=total;win[k].push(value(a));lose[k].push(value(b));}
 }
 const before=value(S);
 // Strategies (averages) and their running sums.
 const jam=Array.from({length:P},()=>new Float64Array(n).fill(0.3)),call=Array.from({length:P},(_,k)=>Array.from({length:P},(_,q)=>q>k?new Float64Array(n).fill(0.3):null));
 const fold=(k:number)=>k===bbI;// the big blind never acts first-in (everyone folded: he wins the pot)
 for(let t=1;t<=iters;t++){
  // Value of the action reaching player k first-in, as a vector over players (averaged over the hands of k and later).
  const open:number[][]=new Array(P+1);open[P]=steal[bbI];
  const C:number[][][]=Array.from({length:P},()=>new Array(P+1));
  const bestJam:Float64Array[]=[],bestCall:(Float64Array|null)[][]=Array.from({length:P},()=>new Array(P).fill(null));
  for(let k=P-1;k>=0;k--){
   if(fold(k)){open[k]=steal[bbI];bestJam[k]=new Float64Array(n);continue;}
   // Continuation after k's all-in, from caller q on (k's hand: its jam range).
   const jr=jam[k];let jw=0;for(let i=0;i<n;i++)jw+=prior[i]*jr[i];
   C[k][P]=steal[k];
   for(let q=P-1;q>k;q--){
    const cq=call[k][q]!,bc=new Float64Array(n),foldV=C[k][q+1];
    const vec=new Array(P).fill(0);let pc=0;
    for(let j=0;j<n;j++){
     let ww=0,e=0;for(let i=0;i<n;i++){const x=w[j*n+i]*jr[i]*prior[i];if(!x)continue;ww+=x;e+=x*eq[j*n+i];}
     if(!ww){bc[j]=0;continue;}e/=ww;
     const callV=e*lose[k][q][q]+(1-e)*win[k][q][q];bc[j]=callV>foldV[q]?1:0;
     const pj=prior[j]*cq[j];pc+=pj;for(let r=0;r<P;r++)vec[r]+=pj*(e*lose[k][q][r]+(1-e)*win[k][q][r]);
    }
    for(let r=0;r<P;r++)vec[r]+=(1-pc)*foldV[r];C[k][q]=vec;bestCall[k][q]=bc;
   }
   // Jammer's best response, hand by hand (callers' ranges with card removal against this hand).
   const bj=new Float64Array(n),foldK=open[k+1][k];
   for(let i=0;i<n;i++){
    let pNo=1,v=0;
    for(let q=k+1;q<P;q++){const cq=call[k][q]!;let tot=0,cw=0,e=0;for(let j=0;j<n;j++){const x=w[i*n+j];if(!x)continue;tot+=x;const y=x*cq[j];cw+=y;e+=y*eq[i*n+j];}
     const pc=tot?cw/tot:0;if(cw>0){e/=cw;v+=pNo*pc*(e*win[k][q][k]+(1-e)*lose[k][q][k]);}pNo*=1-pc;}
    v+=pNo*steal[k][k];bj[i]=v>foldK?1:0;
   }
   bestJam[k]=bj;
   const vec=new Array(P).fill(0);for(let r=0;r<P;r++)vec[r]=jw*C[k][k+1][r]+(1-jw)*open[k+1][r];open[k]=vec;
  }
  const a=1/(t+1);
  for(let k=0;k<P;k++){if(fold(k))continue;for(let i=0;i<n;i++)jam[k][i]+=a*(bestJam[k][i]-jam[k][i]);
   for(let q=k+1;q<P;q++){const c=call[k][q]!,b=bestCall[k][q]!;for(let i=0;i<n;i++)c[i]+=a*(b[i]-c[i]);}}
 }
 const pct=(f:Float64Array)=>{let s=0;for(let i=0;i<n;i++)s+=prior[i]*f[i];return Math.round(s*1000)/10;};
 const round=(f:Float64Array)=>Array.from(f,x=>Math.round(x*100)/100);
 return {labels:L,jam:jam.map((f,k)=>fold(k)?new Array(n).fill(0):round(f)),call:call.map(r=>r.map(c=>c?round(c):null)),
  jamPct:jam.map((f,k)=>fold(k)?0:pct(f)),callPct:call.map(r=>r.map(c=>c?pct(c):null)),equityBefore:before,iterations:iters};
}

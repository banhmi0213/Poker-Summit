/** Heads-up preflop solver (100BB, no ante, no rake) — simplified model (2026/10/29).
 *
 * Real ring hands are mostly two-handed, with limps (owner 10/29: GTOで判定できないハンドが多い), so the 6-max chart
 * (no limps, SB acting first after the flop) does not fit them. In heads-up the button posts the small blind, acts first
 * before the flop and last after it.
 * - SB (button): fold / limp / open 2.5BB. BB after a limp: check / raise to 4BB. SB after that raise: fold / call /
 *   3-bet to 12BB. BB after an open: fold / call / 3-bet to 10BB. 4-bet 22BB, then all-in.
 * - Postflop is not played out: as in the 6-max model, a called pot is worth pot × share, the share being the preflop
 *   all-in equity adjusted by position (the SB is in position) and playability.
 * Solved with Discounted CFR (alpha 1.5, beta 0, gamma 2).
 */
import {playability,type PreflopAction,type PreflopDecision,type PreflopNode,type PreflopTerminal} from './preflop-solver';

export const HU_POSITIONS=['SB','BB'] as const;
const STACK=100;
/** [BB (out of position), SB (in position)] share of equity each side realises. */
export const HU_REALIZE:Record<string,[number,number]>={limp:[0.85,1.0],srp:[0.82,1.0],'3bp':[0.9,1.0],'4bp':[0.95,1.0],allin:[1,1]};
type Kind='limp'|'srp'|'3bp'|'4bp'|'allin';

export function buildHuTree(){
 let id=0;const decisions:PreflopDecision[]=[];
 const dec=(player:number,history:string,facing:number,actions:PreflopAction[],children:PreflopNode[]):PreflopDecision=>{const d:PreflopDecision={type:'decision',id:id++,player,history,facing,actions,children};decisions.push(d);return d;};
 const win=(inv:number[],winner:number):PreflopTerminal=>({type:'terminal',invested:inv,winner});
 const show=(inv:number[],kind:Kind):PreflopTerminal=>({type:'terminal',invested:inv,showdown:{a:0,b:1,kind:kind as 'srp'}});
 const fold={label:'フォールド',kind:'fold'} as const,call={label:'コール',kind:'call'} as const,jam={label:'オールイン',kind:'allin',to:STACK} as const;
 // All-in decided: the other side calls or folds.
 const facingJam=(p:number,inv:number[],h:string)=>{const c=[...inv];c[p]=STACK;return dec(p,h,STACK,[fold,call],[win(inv,1-p),show(c,'allin')]);};
 const facingFour=(p:number,inv:number[],h:string)=>{const four=inv[1-p],c=[...inv];c[p]=four;const j=[...inv];j[p]=STACK;
  return dec(p,h,four,[fold,call,jam],[win(inv,1-p),show(c,'4bp'),facingJam(1-p,j,h+` ${p?'BB':'SB'}AI`)]);};
 const facingThree=(p:number,inv:number[],h:string,four:number)=>{const three=inv[1-p],c=[...inv];c[p]=three;const r=[...inv];r[p]=four;
  return dec(p,h,three,[fold,call,{label:`4ベット ${four}BB`,kind:'raise',to:four}],[win(inv,1-p),show(c,'3bp'),facingFour(1-p,r,h+` ${p?'BB':'SB'}${four}`)]);};
 // BB after an open.
 const vsOpen=(inv:number[],h:string)=>{const c=[...inv];c[1]=2.5;const r=[...inv];r[1]=10;
  return dec(1,h,2.5,[fold,call,{label:'3ベット 10BB',kind:'raise',to:10}],[win(inv,0),show(c,'srp'),facingThree(0,r,h+' BB10',22)]);};
 // SB after a limp and the BB's raise.
 const vsIso=(inv:number[],h:string)=>{const c=[...inv];c[0]=4;const r=[...inv];r[0]=12;
  return dec(0,h,4,[fold,call,{label:'3ベット 12BB',kind:'raise',to:12}],[win(inv,1),show(c,'srp'),facingThree(1,r,h+' SB12',26)]);};
 // BB after a limp: check or raise.
 const vsLimp=(inv:number[],h:string)=>{const r=[...inv];r[1]=4;
  return dec(1,h,1,[{label:'チェック',kind:'check'},{label:'レイズ 4BB',kind:'raise',to:4}],[show(inv,'limp'),vsIso(r,h+' BB4')]);};
 const limped=[1,1],opened=[2.5,1];
 const root=dec(0,'',1,[fold,{label:'リンプ（コール）',kind:'call'},{label:'オープン 2.5BB',kind:'raise',to:2.5}],[win([0.5,1],1),vsLimp(limped,'SBC'),vsOpen(opened,'SB2.5')]);
 return {root,decisions};
}

type Equity={labels:string[];eq:number[][]};
export class HuPreflopSolver{
 readonly n:number;readonly labels:string[];readonly prior:Float64Array;readonly pair:Float64Array;readonly eq:Float64Array;readonly play:Float64Array;
 readonly root:PreflopNode;readonly decisions:PreflopDecision[];readonly regret:Float64Array[];readonly avg:Float64Array[];iterations=0;
 constructor(equity:Equity){
  const n=equity.labels.length;this.n=n;this.labels=equity.labels;
  const combos=Float64Array.from(equity.labels,l=>l.length===2?6:l[2]==='s'?4:12);this.prior=Float64Array.from(combos,c=>c/1326);
  const ranks='23456789TJQKA',cards=equity.labels.map(l=>{const a=ranks.indexOf(l[0]),b=ranks.indexOf(l[1]),out:[number,number][]=[];
   for(let x=0;x<4;x++)for(let y=0;y<4;y++){if(a===b&&y<=x)continue;if(l[2]==='s'&&x!==y)continue;if(l[2]==='o'&&x===y)continue;out.push([a*4+x,b*4+y]);}return out;});
  this.pair=new Float64Array(n*n);this.eq=new Float64Array(n*n);this.play=Float64Array.from(equity.labels,playability);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){let ok=0;for(const [p,q] of cards[i])for(const [r,s] of cards[j])if(p!==r&&p!==s&&q!==r&&q!==s)ok++;this.pair[i*n+j]=ok/(combos[i]*1225);this.eq[i*n+j]=equity.eq[i][j]/10000;}
  const {root,decisions}=buildHuTree();this.root=root;this.decisions=decisions;
  this.regret=decisions.map(d=>new Float64Array(n*d.actions.length));this.avg=decisions.map(d=>new Float64Array(n*d.actions.length));
 }
 strategy(d:PreflopDecision,average=false){
  const k=d.actions.length,n=this.n,src=average?this.avg[d.id]:this.regret[d.id],out=new Float64Array(n*k);
  for(let h=0;h<n;h++){let sum=0;for(let a=0;a<k;a++){const v=Math.max(0,src[h*k+a]);out[h*k+a]=v;sum+=v;}for(let a=0;a<k;a++)out[h*k+a]=sum>0?out[h*k+a]/sum:1/k;}
  return out;
 }
 #mass(r:Float64Array){let m=0;for(let h=0;h<this.n;h++)m+=this.prior[h]*r[h];return m;}
 #walk(node:PreflopNode,reach:Float64Array[]):Float64Array[]{
  const n=this.n;
  if(node.type==='terminal'){
   const values=[new Float64Array(n),new Float64Array(n)],pot=node.invested[0]+node.invested[1];
   if(node.winner!==undefined){for(const p of [0,1]){const others=this.#mass(reach[1-p]);values[p].fill(((p===node.winner?pot:0)-node.invested[p])*others);}return values;}
   const [rOop,rIp]=HU_REALIZE[node.showdown!.kind],deep=node.showdown!.kind!=='allin';
   for(const me of [0,1]){const op=1-me,rMe=me===0?rIp:rOop,rOp=me===0?rOop:rIp,ro=reach[op],v=values[me];
    for(let h=0;h<n;h++){let s=0;const pm=deep?this.play[h]:1;for(let o=0;o<n;o++){const w=this.pair[h*n+o]*ro[o];if(!w)continue;const e=this.eq[h*n+o],a1=e*rMe*pm,b1=(1-e)*rOp*(deep?this.play[o]:1);s+=w*(a1/(a1+b1)*pot-node.invested[me]);}v[h]=s;}}
   return values;
  }
  const k=node.actions.length,p=node.player,sigma=this.strategy(node),values=[new Float64Array(n),new Float64Array(n)],av:Float64Array[]=[];
  for(let a=0;a<k;a++){
   const next=reach.map((r,q)=>{if(q!==p)return r;const out=new Float64Array(n);for(let h=0;h<n;h++)out[h]=r[h]*sigma[h*k+a];return out;});
   const child=this.#walk(node.children[a],next);av.push(child[p]);
   for(const q of [0,1]){const v=values[q],c=child[q];if(q===p){for(let h=0;h<n;h++)v[h]+=sigma[h*k+a]*c[h];}else for(let h=0;h<n;h++)v[h]+=c[h];}
  }
  const regret=this.regret[node.id],avg=this.avg[node.id],t=this.iterations+1,pos=Math.pow(t,1.5)/(Math.pow(t,1.5)+1),wAvg=Math.pow(t/(t+1),2),r=reach[p];
  for(let h=0;h<n;h++)for(let a=0;a<k;a++){const i=h*k+a,g=av[a][h]-values[p][h];regret[i]=(regret[i]>0?regret[i]*pos:0)+g;avg[i]=avg[i]*wAvg+r[h]*sigma[i];}
  return values;
 }
 run(iterations:number){for(let i=0;i<iterations;i++){this.#walk(this.root,[new Float64Array(this.n).fill(1),new Float64Array(this.n).fill(1)]);this.iterations++;}}
 averageRegret(){let s=0,c=0;for(const d of this.decisions){const k=d.actions.length,r=this.regret[d.id];for(let h=0;h<this.n;h++){let m=0;for(let a=0;a<k;a++)m=Math.max(m,r[h*k+a]);s+=m;c++;}}return s/c/Math.max(1,this.iterations);}
}

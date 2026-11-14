// joint-proto.cjs (2026/11/15, prototype): preflop and postflop solved as ONE game for a single heads-up spot,
// BTN opens 2.5, SB folds, BB to act. Instead of a precomputed table of postflop pot shares, the postflop is played
// inside the same CFR with a card abstraction: sampled flops and runouts, hands grouped into strength buckets
// (flop: E[HS^2] over the runouts, river: hand-strength percentile). Postflop strategies are per bucket, so they
// change with the ranges that reach the flop, and preflop values change with them.
// Usage: node scripts/poker-gto/joint-proto.cjs --chart <preflop chart json> [--iters 400] [--flops 24] [--runs 6]
//        [--buckets 10] [--seed 1] [--out file]
// The BTN opening range is taken from --chart (fixed). Output: BB and BTN strategies per class at the solved nodes.
require('./common.cjs');
const fs=require('fs'),path=require('path');
const {evalCodes}=require(path.resolve(__dirname,'../../lib/poker/fast-eval.ts'));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const ITERS=+arg('iters',400),NF=+arg('flops',24),NR=+arg('runs',6),B=+arg('buckets',10);let seed=+arg('seed',1);
const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const EQ=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'),'utf8'));
const LABELS=EQ.labels,NC=LABELS.length,CIDX=Object.fromEntries(LABELS.map((l,i)=>[l,i]));
// ---- combos
const R='23456789TJQKA';const combos=[],cls=[];
for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){const ra=a>>2,rb=b>>2,hi=Math.max(ra,rb),lo=Math.min(ra,rb);
 const lab=ra===rb?R[ra]+R[rb]:R[hi]+R[lo]+((a&3)===(b&3)?'s':'o');combos.push([a,b]);cls.push(CIDX[lab]);}
const N=combos.length;
// ---- BTN open range from the chart
const chart=JSON.parse(fs.readFileSync(arg('chart'),'utf8'));
const btnNode=chart.nodes.find(n=>n.player==='BTN'&&n.history==='UTGF HJF COF');
const btnOpen=new Float64Array(N);for(let i=0;i<N;i++){const s=btnNode.strategy[LABELS[cls[i]]];btnOpen[i]=s?s[1]:0;}
// ---- boards: flops and runouts, ranks and buckets
const boards=[];
for(let f=0;f<NF;f++){const used=new Set();const flop=[];while(flop.length<3){const c=Math.floor(rnd()*52);if(!used.has(c)){used.add(c);flop.push(c);}}
 const runs=[];for(let r=0;r<NR;r++){const u=new Set(used),tr=[];while(tr.length<2){const c=Math.floor(rnd()*52);if(!u.has(c)){u.add(c);tr.push(c);}}runs.push(tr);}
 const ok=new Uint8Array(N);for(let i=0;i<N;i++){const [a,b]=combos[i];ok[i]=used.has(a)||used.has(b)?0:1;}
 const hs2=new Float64Array(N),rv=[];
 for(const [t,rv_] of runs){const board=[...flop,t,rv_];const okr=new Uint8Array(N),rank=new Float64Array(N);const live=[];
  for(let i=0;i<N;i++){const [a,b]=combos[i];if(!ok[i]||a===t||b===t||a===rv_||b===rv_)continue;okr[i]=1;rank[i]=evalCodes([a,b,...board]);live.push(i);}
  live.sort((x,y)=>rank[x]-rank[y]);
  // percentile with ties sharing the middle
  const pct=new Float64Array(N);let k=0;while(k<live.length){let e=k;while(e+1<live.length&&rank[live[e+1]]===rank[live[k]])e++;const p=((k+e)/2+0.5)/live.length;for(let q=k;q<=e;q++)pct[live[q]]=p;k=e+1;}
  for(const i of live)hs2[i]+=pct[i]*pct[i]/NR;
  const bucket=new Int16Array(N).fill(-1);for(const i of live)bucket[i]=Math.min(B-1,Math.floor(pct[i]*B));
  // groups of equal rank in ascending order, for the showdown sweep
  const groups=[];k=0;while(k<live.length){let e=k;while(e+1<live.length&&rank[live[e+1]]===rank[live[k]])e++;groups.push(live.slice(k,e+1));k=e+1;}
  // turn: strength percentile on the 6-card board (E[HS^2] over 8 sampled rivers)
  const okt=new Uint8Array(N),ths=new Float64Array(N),tl=[];for(let i=0;i<N;i++){const [a,b]=combos[i];if(!ok[i]||a===t||b===t)continue;okt[i]=1;tl.push(i);}
  const u2=new Set([...flop,t]);for(let q=0;q<8;q++){let rr;do{rr=Math.floor(rnd()*52);}while(u2.has(rr));const bd=[...flop,t,rr],rk=new Float64Array(N),lv=tl.filter(i=>combos[i][0]!==rr&&combos[i][1]!==rr);
   for(const i of lv)rk[i]=evalCodes([combos[i][0],combos[i][1],...bd]);lv.sort((x,y)=>rk[x]-rk[y]);lv.forEach((i,k2)=>{const p=(k2+0.5)/lv.length;ths[i]+=p*p/8;});}
  const tb=new Int16Array(N).fill(-1);const ts=tl.slice().sort((x,y)=>ths[x]-ths[y]);ts.forEach((i,k2)=>tb[i]=Math.min(B-1,Math.floor(k2/ts.length*B)));
  rv.push({okr,okt,rinfo:Int32Array.from(bucket),tinfo:Int32Array.from(tb),groups,cards:[t,rv_]});}
 // flop buckets: E[HS^2] quantiles over the live combos
 const live=[];for(let i=0;i<N;i++)if(ok[i])live.push(i);live.sort((x,y)=>hs2[x]-hs2[y]);
 const fb=new Int16Array(N).fill(-1);live.forEach((i,k)=>fb[i]=Math.min(B-1,Math.floor(k/live.length*B)));
 boards.push({flop,ok,fb,finfo:Int32Array.from(fb),runs:rv});}
// ---- regret tables
function table(nInfo,k){return {k,reg:new Float64Array(nInfo*k),avg:new Float64Array(nInfo*k)};}
function strat(t,info,out){const k=t.k;let s=0;for(let a=0;a<k;a++){const v=Math.max(0,t.reg[info*k+a]);out[a]=v;s+=v;}for(let a=0;a<k;a++)out[a]=s>0?out[a]/s:1/k;}
let T=0;const avgStrat=(t,info,out)=>{const k=t.k;let s=0;for(let a=0;a<k;a++)s+=t.avg[info*k+a];for(let a=0;a<k;a++)out[a]=s>0?t.avg[info*k+a]/s:1/k;};
// Decision at a node: player p, infoset id per combo (or -1 = not live), k actions. children(a, reachP') -> [v0,v1].
// Values are counterfactual (already weighted by the opponent's reach). Players: 0 = OOP (BB), 1 = IP (BTN).
const sg=new Float64Array(8);
function decide(t,infoOf,p,reach,k,child,train){
 const rp=reach[p],sig=new Float64Array(N*k);
 for(let i=0;i<N;i++){const inf=infoOf[i];if(inf<0)continue;(train?strat:avgStrat)(t,inf,sg);for(let a=0;a<k;a++)sig[i*k+a]=sg[a];}
 const v0=new Float64Array(N),v1=new Float64Array(N),cv=[];
 for(let a=0;a<k;a++){const nr=new Float64Array(N);for(let i=0;i<N;i++)nr[i]=infoOf[i]<0?0:rp[i]*sig[i*k+a];
  const r2=p===0?[nr,reach[1]]:[reach[0],nr];const [c0,c1]=child(a,r2);cv.push(p===0?c0:c1);
  const vp=p===0?v0:v1,vo=p===0?v1:v0,co=p===0?c1:c0,cp=p===0?c0:c1;
  for(let i=0;i<N;i++){vp[i]+=sig[i*k+a]*cp[i];vo[i]+=co[i];}}
 if(train){const vp=p===0?v0:v1,w=T;for(let i=0;i<N;i++){const inf=infoOf[i];if(inf<0)continue;for(let a=0;a<k;a++){t.reg[inf*k+a]+=cv[a][i]-vp[i];t.avg[inf*k+a]+=w*rp[i]*sig[i*k+a];}}
  // CFR+: floor regrets
  }
 return [v0,v1];
}
function floorAll(ts){for(const t of ts)for(let j=0;j<t.reg.length;j++)if(t.reg[j]<0)t.reg[j]=0;}
// ---- terminals
// fold: winner gets pot; each player's payoff = (won? pot:0) - invested. Weighted by opponent reach sum (no card removal).
function foldVal(reach,pot,inv,winner,okMask){let s0=0,s1=0;for(let i=0;i<N;i++){if(okMask&&!okMask[i])continue;s0+=reach[0][i];s1+=reach[1][i];}
 const v0=new Float64Array(N),v1=new Float64Array(N),p0=(winner===0?pot:0)-inv[0],p1=(winner===1?pot:0)-inv[1];
 for(let i=0;i<N;i++){if(okMask&&!okMask[i])continue;v0[i]=p0*s1;v1[i]=p1*s0;}return [v0,v1];}
function showdown(reach,pot,inv,run){const v0=new Float64Array(N),v1=new Float64Array(N);
 for(const [me,op,v] of [[0,1,v0],[1,0,v1]]){const ro=reach[op];let tot=0;for(const g of run.groups)for(const j of g)tot+=ro[j];
  let below=0;for(const g of run.groups){let eq=0;for(const j of g)eq+=ro[j];const above=tot-below-eq;
   for(const i of g)v[i]=below*(pot-inv[me])+eq*(pot/2-inv[me])+above*(-inv[me]);below+=eq;}}
 return [v0,v1];}
// ---- postflop game (per pot type): flop, turn, river betting rounds over the sampled runouts.
// Sizes: flop 33% pot; turn 75%; river 75% and all-in. Facing a bet: fold, call, and on the turn/river raise all-in.
// Infosets: (pot type, board id, street, betting history) x strength bucket of the street.
const SIZES={flop:[0.33],turn:[0.75],river:[0.75,9]};
function makePost(name,pot0,stack){
 const T2=new Map();// key -> table with B rows
 const tab=(key,k)=>{let t=T2.get(key);if(!t){t=table(B,k);T2.set(key,t);}return t;};
 const infoOf=(bucket)=>{const o=new Int32Array(N);for(let i=0;i<N;i++)o[i]=bucket[i];return o;};
 // one betting round. ctx: {street, key(board id), bucket(Int16Array), ok(mask)}; next(reach,pot,inv,hist) continues.
 function round(ctx,reach,pot,inv,hist,next,train){
  const left=p=>stack-(inv[p]-base[p]);
  function node(p,reach,pot,inv,facing,raised,h){
   const acts=[];
   if(!facing){acts.push(['x']);for(const f of SIZES[ctx.street]){const amt=Math.min(left(p),f>=9?left(p):Math.round(pot*f*100)/100);if(amt>0&&!acts.some(a=>a[1]===amt))acts.push(['b',amt]);}}
   else{acts.push(['f'],['c']);const callAmt=Math.min(facing,left(p));if(ctx.street!=='flop'&&!raised&&left(p)>callAmt)acts.push(['r',left(p)]);}
   const t=tab(name+'|'+ctx.key+'|'+h+'|'+p,acts.length),info=ctx.info;
   return decide(t,info,p,reach,acts.length,(a,r2)=>{const [k,amt]=acts[a],o=1-p;
    if(k==='f')return foldVal(r2,pot,inv,o,ctx.ok);
    if(k==='x'){if(p===1||h.endsWith('x'))return next(r2,pot,inv,h+'x');return node(1,r2,pot,inv,0,false,h+'x');}
    if(k==='c'){const c=Math.min(facing,left(p));const iv=inv.slice();iv[p]+=c;return next(r2,pot+c,iv,h+'c');}
    // bet or raise: amt = chips this player adds now; the opponent then faces (amt - what it already matched this round)
    const iv=inv.slice();iv[p]+=amt;const face=amt-(facing||0);return node(o,r2,pot+amt,iv,face,k==='r'||raised,h+k);
   },train);}
  return node(0,reach,pot,inv,0,false,hist);
 }
 let base=[0,0];
 function mask(reach,ok){return [reach[0].map((x,i)=>ok[i]?x:0),reach[1].map((x,i)=>ok[i]?x:0)];}
 function streetRiver(f,r,reach,pot,inv,hist,train){const run=boards[f].runs[r];
  const ctx={street:'river',key:f+'.'+r+'R'+hist,info:run.rinfo,ok:run.okr};
  return round(ctx,mask(reach,run.okr),pot,inv,'',(rc,p,iv)=>showdown(rc,p,iv,run),train);}
 function streetTurn(f,r,reach,pot,inv,hist,train){const run=boards[f].runs[r];
  const ctx={street:'turn',key:f+'.'+r+'T'+hist,info:run.tinfo,ok:run.okt};
  return round(ctx,mask(reach,run.okt),pot,inv,'',(rc,p,iv,h)=>streetRiver(f,r,rc,p,iv,hist+'/'+h,train),train);}
 function streetFlop(f,reach,pot,inv,train){const b=boards[f];
  const ctx={street:'flop',key:f+'F',info:b.finfo,ok:b.ok};
  return round(ctx,mask(reach,b.ok),pot,inv,'',(rc,p,iv,h)=>{const out=[new Float64Array(N),new Float64Array(N)];
   for(let r=0;r<NR;r++){const [a,c]=streetTurn(f,r,rc,p,iv,h,train);for(let i=0;i<N;i++){out[0][i]+=a[i]/NR;out[1][i]+=c[i]/NR;}}return out;},train);}
 return {name,tables:()=>[...T2.values()],play(reach,inv,train){base=inv.slice();const pot=inv[0]+inv[1]+0.5;const out=[new Float64Array(N),new Float64Array(N)];
  for(let f=0;f<NF;f++){const [a,b]=streetFlop(f,reach,pot,inv,train);for(let i=0;i<N;i++){out[0][i]+=a[i]/NF;out[1][i]+=b[i]/NF;}}return out;}};
}
const SRP=makePost('srp',5.5,97.5),TBP=makePost('3bp',26.5,87);
// ---- preflop part. Player 0 = BB, 1 = BTN. Invested: BB 1, BTN 2.5, SB 0.5 dead.
const classInfo=Int32Array.from(cls);
const tBB=table(NC,3),tBTN=table(NC,3),tBB4=table(NC,2),tBTNa=table(NC,2);
function allin(reach){// both all-in for 100: class-level equity, no card removal
 const pot=200.5,cr=[new Float64Array(NC),new Float64Array(NC)];for(let i=0;i<N;i++){cr[0][cls[i]]+=reach[0][i];cr[1][cls[i]]+=reach[1][i];}
 const v0=new Float64Array(N),v1=new Float64Array(N);const memo=[new Float64Array(NC),new Float64Array(NC)];
 for(const [me,op] of [[0,1],[1,0]])for(let c=0;c<NC;c++){let s=0;for(let d=0;d<NC;d++){if(!cr[op][d])continue;s+=cr[op][d]*(EQ.eq[c][d]/10000*pot-100);}memo[me][c]=s;}
 for(let i=0;i<N;i++){v0[i]=memo[0][cls[i]];v1[i]=memo[1][cls[i]];}return [v0,v1];}
function root(train){const reach=[new Float64Array(N).fill(1),Float64Array.from(btnOpen)];
 return decide(tBB,classInfo,0,reach,3,(a,r2)=>{
  if(a===0)return foldVal(r2,4,[1,2.5],1);
  if(a===1)return SRP.play(r2,[2.5,2.5],train);
  return decide(tBTN,classInfo,1,r2,3,(b,r3)=>{
   if(b===0)return foldVal(r3,16,[13,2.5],0);
   if(b===1)return TBP.play(r3,[13,13],train);
   return decide(tBB4,classInfo,0,r3,2,(c,r4)=>c===0?foldVal(r4,41,[13,27.5],1)
    :decide(tBTNa,classInfo,1,r4,2,(d,r5)=>d===0?foldVal(r5,128,[100,27.5],0):allin(r5),train),train);},train);},train);}
const t0=Date.now();
for(let it=1;it<=ITERS;it++){T=it;root(true);floorAll([tBB,tBTN,tBB4,tBTNa,...SRP.tables(),...TBP.tables()]);
 if(it%50===0)console.log('iter',it,((Date.now()-t0)/1000).toFixed(0)+'s');}
// ---- output: average strategies per class
const out={iters:ITERS,flops:NF,runs:NR,buckets:B,nodes:[]};const sv=new Float64Array(4);
for(const [name,t,acts] of [['BB vs BTN 2.5',tBB,['F','C','R13']],['BTN vs BB 3bet',tBTN,['F','C','R27.5']],['BB vs 4bet',tBB4,['F','A']],['BTN vs allin',tBTNa,['F','C']]]){
 const st={};for(let c=0;c<NC;c++){avgStrat(t,c,sv);st[LABELS[c]]=[...sv.slice(0,t.k)].map(x=>+x.toFixed(3));}out.nodes.push({name,actions:acts,strategy:st});}
fs.writeFileSync(arg('out','joint-proto.json'),JSON.stringify(out));console.log('done',((Date.now()-t0)/1000).toFixed(0)+'s');
// Diagnosis (DIAG=1): realisation of the called pot for BB and BTN classes with the average strategies.
if(process.env.DIAG){const reach=[new Float64Array(N).fill(1),Float64Array.from(btnOpen)];const [v0,v1]=SRP.play(reach,[2.5,2.5],false);
 let s1=0;for(let i=0;i<N;i++)s1+=reach[1][i];const cr=new Float64Array(NC);for(let i=0;i<N;i++)cr[cls[i]]+=reach[1][i];
 const pot=5.5;const rows=[];for(const h of ['AA','AKs','KQo','JTs','T9o','98o','72o','K2o','Q5s']){const c=CIDX[h];let e=0,w=0;for(let d=0;d<NC;d++){e+=cr[d]*EQ.eq[c][d]/10000;w+=cr[d];}
  let v=0,n=0;for(let i=0;i<N;i++)if(cls[i]===c){v+=v0[i];n++;}v/=n;const val=v/s1+2.5;rows.push(h+' eq '+(e/w).toFixed(3)+' share '+(val/pot).toFixed(3)+' R '+(val/pot/(e/w)).toFixed(2));}
 console.log(rows.join('\n'));}
if(process.env.DIAG){const reach=[new Float64Array(N).fill(1),Float64Array.from(btnOpen)];const [v0,v1]=SRP.play(reach,[2.5,2.5],false);
 let a=0,b=0,s0=0,s1=0;for(let i=0;i<N;i++){a+=v0[i]*reach[0][i];b+=v1[i]*reach[1][i];s0+=reach[0][i];s1+=reach[1][i];}
 console.log('avg BB',(a/s0/s1).toFixed(3),'avg BTN',(b/s0/s1).toFixed(3),'sum+5',(a/s0/s1+b/s0/s1+5).toFixed(3));}

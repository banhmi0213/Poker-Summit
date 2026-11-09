// Pooled postflop value table (2026/11/09, owner: やり方変えていけ).
// A spot's few solved flops give noisy class values (a class that hit the chosen boards looks strong). Instead:
// 1. Pool every solved flop of every spot and round by pot kind (srp/3bp/4bp/limp) and role (side oop/ip, aggressor or not),
//    and fit how much of the pot a hand ends up with from its equity on that flop: y = g(equity) + h(class), g piecewise
//    linear on 11 knots, h a per-class shift shrunk toward 0 (K / (n + K), n = samples of the class).
// 2. Value each class of a spot by passing its equity on many representative flops (texture-weighted) through that curve,
//    with the spot's current ranges. Board luck of the solved flops drops out; only how hands realise their equity is learnt.
// Usage: node scripts/poker-gto/pooled-table.cjs --data dir1,dir2,... --ranges dir --out file [--flops 50] [--k 20]
// data dirs hold <spot>/<flop>.json with <flop>.eq.json (scripts/poker-gto/flop-equity.cjs); ranges dir gives each spot's
// current chartRanges (its first solved flop).
const fs=require('fs'),path=require('path');require('./common.cjs');
const {allTextures,texture,distance}=require(path.resolve(__dirname,'../../lib/poker/flop-subset.ts'));
const {equities,labels}=require('./flop-equity.cjs');
const SPOTS=require('./spots.cjs');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
const DATA=arg('data','').split(',').filter(Boolean),RANGES=arg('ranges'),OUT=arg('out'),NF=Number(arg('flops',50)),K=Number(arg('k',20));
function kindOf(line){
 const toks=line.split(' ').map(t=>/^(UTG|HJ|CO|BTN|SB|BB)(.*)$/.exec(t)).filter(Boolean);
 const raises=toks.filter(m=>m[2]!=='F'&&m[2]!=='C');
 const limp=toks.some(m=>m[1]==='SB'&&m[2]==='C')&&!raises.some(m=>m[1]!=='BB');
 if(limp&&!raises.length)return {kind:'limp',aggr:'-'};
 const k=raises.length<=1?'srp':raises.length===2?'3bp':'4bp';
 return {kind:limp&&raises.length===1?'srp':k,aggr:raises.length?raises[raises.length-1][1]:'-'};
}
const roleOf=(S,side)=>{const {kind,aggr}=kindOf(S.line);return `${kind}|${side}|${(side==='oop'?S.oop:S.ip)===aggr?'A':'N'}`;};
// 1. Samples per group.
const KN=11,hat=x=>{const t=Math.min(Math.max(x,0),1)*(KN-1),i=Math.min(Math.floor(t),KN-2),f=t-i;const v=new Array(KN).fill(0);v[i]=1-f;v[i+1]=f;return v;};
const groups={};
for(const root of DATA)for(const id of fs.readdirSync(root)){const S=SPOTS[id],dir=path.join(root,id);if(!S||!fs.statSync(dir).isDirectory())continue;
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!f.endsWith('.eq.json'))){const ef=path.join(dir,f.replace('.json','.eq.json'));if(!fs.existsSync(ef))continue;
  const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')),e=JSON.parse(fs.readFileSync(ef,'utf8'));if(!d.handEv)continue;
  for(const side of ['oop','ip']){const g=groups[roleOf(S,side)]??={xs:[],ys:[],cs:[],ss:[]};
   for(const [c,v] of Object.entries(d.handEv[side])){const q=e[side][c];if(q===undefined)continue;g.xs.push(q);g.ys.push(v/d.spot.pot);g.cs.push(c);g.ss.push(id+'|'+side);}}}}
// Fit g (ridge-smoothed piecewise linear) then shrunk class shifts.
const model={},spotOff={};
for(const [gk,g] of Object.entries(groups)){const A=Array.from({length:KN},()=>new Array(KN+1).fill(0));
 g.xs.forEach((x,n)=>{const h=hat(x);for(let i=0;i<KN;i++){if(!h[i])continue;for(let j=0;j<KN;j++)A[i][j]+=h[i]*h[j];A[i][KN]+=h[i]*g.ys[n];}});
 const lam=g.xs.length*1e-3;for(let i=0;i<KN;i++){A[i][i]+=lam*2;if(i>0)A[i][i-1]-=lam;if(i<KN-1)A[i][i+1]-=lam;}
 for(let i=0;i<KN;i++){let m=i;for(let r=i+1;r<KN;r++)if(Math.abs(A[r][i])>Math.abs(A[m][i]))m=r;[A[i],A[m]]=[A[m],A[i]];for(let r=0;r<KN;r++){if(r===i)continue;const c=A[r][i]/A[i][i];for(let j=i;j<=KN;j++)A[r][j]-=c*A[i][j];}}
 const knots=A.map((r,i)=>r[KN]/r[i]),G=x=>hat(x).reduce((s,w,i)=>s+w*knots[i],0);
 const sum={},cnt={};g.xs.forEach((x,n)=>{const c=g.cs[n];sum[c]=(sum[c]??0)+g.ys[n]-G(x);cnt[c]=(cnt[c]??0)+1;});
 const shift={};for(const c in sum)shift[c]=sum[c]/(cnt[c]+K);
 // Spot level (2026/11/09): how well this spot's hands realise their equity as a whole (position, stack to pot, ranges)
 // differs from the pooled curve; the spot's own flops estimate that one number well, so it is added back.
 const so={},sn={};g.xs.forEach((x,n)=>{const k=g.ss[n];so[k]=(so[k]??0)+g.ys[n]-G(x)-(shift[g.cs[n]]??0);sn[k]=(sn[k]??0)+1;});
 for(const k in so)spotOff[k]=so[k]/sn[k];
 model[gk]={knots,shift,G,n:g.xs.length};
 console.log(gk,'samples',g.xs.length,'knots',knots.map(v=>v.toFixed(2)).join(' '));}
if(arg('adjust')){const t=JSON.parse(fs.readFileSync(arg('adjust'),'utf8'));
 for(const [id,S] of Object.entries(SPOTS)){const {kind,aggr}=kindOf(S.line),key=`${kind}|${S.oop}|${S.ip}|${aggr}`,e=t.table[key];if(!e)continue;
  for(const side of ['oop','ip']){const o=spotOff[id+'|'+side]??0;for(const c in e[side])e[side][c]=Math.round((e[side][c]+o)*10000)/10000;console.log(id,side,'offset',o.toFixed(3));}}
 fs.writeFileSync(OUT,JSON.stringify(t));console.log('saved',OUT);process.exit(0);}
// 2. Representative flops, weighted by the textures nearest to each.
const pool=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/flops.json'),'utf8')),step=Math.max(1,Math.floor(pool.length/NF));
const flops=pool.filter((_,i)=>i%step===0).slice(0,NF),tex=flops.map(texture),w=new Array(flops.length).fill(0);
for(const t of allTextures()){let b=0,bd=Infinity;tex.forEach((x,i)=>{const d=distance(t,x);if(d<bd){bd=d;b=i;}});w[b]+=t.weight;}
const W=w.reduce((a,b)=>a+b);
const out={};
for(const [id,S] of Object.entries(SPOTS)){const dir=path.join(RANGES,id);if(!fs.existsSync(dir))continue;
 const f0=fs.readdirSync(dir).find(f=>f.endsWith('.json')&&!f.endsWith('.eq.json'));if(!f0)continue;const ranges=JSON.parse(fs.readFileSync(path.join(dir,f0),'utf8')).spot.chartRanges;if(!ranges)continue;
 const {kind,aggr}=kindOf(S.line),key=`${kind}|${S.oop}|${S.ip}|${aggr}`,entry={oop:{},ip:{},ranges},t0=Date.now();
 const all1=Object.fromEntries(labels.map(l=>[l,1]));
 for(const side of ['oop','ip']){const m=model[roleOf(S,side)];if(!m)continue;const acc={};
  flops.forEach((fl,i)=>{if(!w[i])return;const eq=equities(fl,all1,ranges[side==='oop'?'ip':'oop']);for(const [c,q] of Object.entries(eq))acc[c]=(acc[c]??0)+w[i]*m.G(q);});
  for(const c in acc)entry[side][c]=Math.round((acc[c]/W+(m.shift[c]??0))*10000)/10000;}
 out[key]=entry;console.log(id,'->',key,((Date.now()-t0)/1000).toFixed(0)+'s');}
fs.writeFileSync(OUT,JSON.stringify({version:1,built:new Date().toISOString().slice(0,10),from:'pooled realisation curve over all solved flops',table:out}));
console.log('saved',OUT,Object.keys(out).length,'spots');

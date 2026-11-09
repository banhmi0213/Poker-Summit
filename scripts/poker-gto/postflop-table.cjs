// Postflop value table for the preflop solver (2026/11/06, owner: プリフロップ表を一から作り直せ).
// From the solved flop files (version 3, handEv), per spot and side: each class's solved value as a share of the pot
// (handEv / pot), averaged over the flops weighted by how often each texture occurs. Written as the PostflopTable of
// lib/poker/preflop-solver.ts (key `${kind}|${oop seat}|${ip seat}|${aggressor seat}`).
// Usage: node scripts/poker-gto/postflop-table.cjs [--out data/poker-gto/postflop-table.json]
const fs=require('fs'),path=require('path');require('./common.cjs');
const {allTextures,texture,distance}=require(path.resolve(__dirname,'../../lib/poker/flop-subset.ts'));
const SPOTS=require('./spots.cjs');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true);};
// --roots a,b (2026/11/06): directories of <spot>/<flop>.json; the first one holding at least --min flops of a spot wins
// (the rebuilt all-hands solves first, the published flops as fallback).
const ROOTS=(arg('roots','')||path.resolve(__dirname,'../../public/poker-gto/flops')).split(',').filter(Boolean),MIN=Number(arg('min',3));
// Pot kind and preflop aggressor from the spot's line: the last raiser.
function kindOf(line){
 const toks=line.split(' ').map(t=>/^(UTG|HJ|CO|BTN|SB|BB)(.*)$/.exec(t)).filter(Boolean);
 const raises=toks.filter(m=>m[2]!=='F'&&m[2]!=='C');
 const limp=toks.some(m=>m[1]==='SB'&&m[2]==='C')&&!raises.some(m=>m[1]!=='BB');
 if(limp&&!raises.length)return {kind:'limp',aggr:'-'};
 const k=raises.length<=1?'srp':raises.length===2?'3bp':'4bp';
 return {kind:limp&&raises.length===1?'srp':k,aggr:raises.length?raises[raises.length-1][1]:'-'};
}
const EQ=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'),'utf8')),EQI=Object.fromEntries(EQ.labels.map((l,i)=>[l,i]));
const RK='23456789TJQKA',cardsOf=l=>{const a=RK.indexOf(l[0]),b=RK.indexOf(l[1]),out=[];for(let x=0;x<4;x++)for(let y=0;y<4;y++){if(a===b&&y<=x)continue;if(l[2]==='s'&&x!==y)continue;if(l[2]==='o'&&x===y)continue;out.push([a*4+x,b*4+y]);}return out;};
const CARDS=Object.fromEntries(EQ.labels.map(l=>[l,cardsOf(l)])),PAIR={};
const pairOk=(h,o)=>{const k=h+'|'+o;if(PAIR[k]!==undefined)return PAIR[k];let ok=0;for(const [p,q] of CARDS[h])for(const [r,t] of CARDS[o])if(p!==r&&p!==t&&q!==r&&q!==t)ok++;return PAIR[k]=ok;};
// Equity of class l against a weighted range over all boards (preflop all-in equity of the class pair, card removal counted).
function eqVs(l,opp){let w=0,s=0;for(const [o,x] of Object.entries(opp)){if(!(x>0))continue;const k=pairOk(l,o)*x;w+=k;s+=k*EQ.eq[EQI[l]][EQI[o]]/10000;}return w>0?s/w:null;}
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[b.length>>1]:NaN;};
const textures=allTextures(),out={},report=[];
for(const [id,S] of Object.entries(SPOTS)){
 if(!S.line||(S.players??2)!==2||id.startsWith('hu-'))continue;
 // --ratio (2026/11/07): from the rebuilt flops (all hands, with <flop>.eq.json from flop-equity.cjs) take each class's
 // realisation = Σ value / Σ equity over the solved flops, times its equity against the same range over all flops.
 // The few solved flops then only have to get the realisation right, not how often the class hits the board.
 if(arg('ratio')){const {kind,aggr}=kindOf(S.line),key=`${kind}|${S.oop}|${S.ip}|${aggr}`,dir=path.join(ROOTS[0],id);
  if(!fs.existsSync(dir))continue;const fl=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!f.endsWith('.eq.json')&&fs.existsSync(path.join(dir,f.replace('.json','.eq.json'))))
   .map(f=>({d:JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')),e:JSON.parse(fs.readFileSync(path.join(dir,f.replace('.json','.eq.json')),'utf8'))})).filter(x=>x.d.handEv);
  if(fl.length<Number(arg('min-ratio',4)))continue;const ranges=fl[0].d.spot.chartRanges,entry={oop:{},ip:{},ranges},rz={oop:{},ip:{}};
  // Control variate: value = mean over the solved flops + b × (equity over all flops − mean equity on the solved flops),
  // b = pooled slope of value on equity across classes and flops (per side). A class that hit unusually often on the
  // chosen flops gets its surplus taken back at the rate value actually moves with equity.
  for(const side of ['oop','ip']){const opp=ranges[side==='oop'?'ip':'oop'],eqAll={};let sx=0,sy=0,sxx=0,sxy=0,N=0;const per={};
   for(const l of EQ.labels){const xs=[],ys=[];for(const {d,e} of fl){const v=d.handEv[side][l],q=e[side][l];if(v===undefined||q===undefined)continue;xs.push(q);ys.push(v/d.spot.pot);}
    if(!xs.length)continue;per[l]=[xs,ys];const mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
    xs.forEach((x,i)=>{sx+=x-mx;sy+=ys[i]-my;sxx+=(x-mx)**2;sxy+=(x-mx)*(ys[i]-my);N++;});}
   const slope=sxx>0?sxy/sxx:1;rz[side].slope=slope;
   for(const [l,[xs,ys]] of Object.entries(per)){const all=eqVs(l,opp);if(all===null)continue;const mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
    entry[side][l]=Math.round((my+slope*(all-mx))*10000)/10000;eqAll[l]=all;}
   // --shrink K (2026/11/09): with only a few solved flops a class's value still carries its own board luck (JTs below K4s
   // in a 3-bet pot). Fit value on equity across classes (quadratic, pair/suited shifts) and pull each class toward that fit
   // by K/(n+K), n = solved flops. K=0 keeps the old table.
   const K=Number(arg('shrink',0));if(K>0){const ls=Object.keys(entry[side]).filter(l=>eqAll[l]!==undefined),n=fl.length,lam=n/(n+K);
    const feat=l=>{const q=eqAll[l];return [1,q,q*q,l.length===2?1:0,l[2]==='s'?1:0];},P=5,A=Array.from({length:P},()=>Array(P+1).fill(0));
    for(const l of ls){const f=feat(l),y=entry[side][l],w=l.length===2?6:l[2]==='s'?4:12;for(let i=0;i<P;i++){for(let j=0;j<P;j++)A[i][j]+=w*f[i]*f[j];A[i][P]+=w*f[i]*y;}}
    for(let i=0;i<P;i++)A[i][i]+=1e-9;
    for(let i=0;i<P;i++){let m=i;for(let r=i+1;r<P;r++)if(Math.abs(A[r][i])>Math.abs(A[m][i]))m=r;[A[i],A[m]]=[A[m],A[i]];for(let r=0;r<P;r++){if(r===i)continue;const c=A[r][i]/A[i][i];for(let j=i;j<=P;j++)A[r][j]-=c*A[i][j];}}
    const beta=A.map((r,i)=>r[P]/r[i]);
    for(const l of ls){const fit=feat(l).reduce((s,x,i)=>s+x*beta[i],0);entry[side][l]=Math.round((fit+lam*(entry[side][l]-fit))*10000)/10000;}}}
  out[key]=entry;report.push(`${id} → ${key}: ratio over ${fl.length} flops, slope oop ${rz.oop.slope.toFixed(2)} ip ${rz.ip.slope.toFixed(2)}`);continue;}
 // --merge: per class, take the root whose flops cover that class most often (old flops: many flops, in-range classes only;
 // rebuilt flops: few flops, every class). The table also keeps the ranges the flops were solved with (entry.ranges), so the
 // preflop solver can follow the opponent's current range.
 if(arg('merge')){const {kind,aggr}=kindOf(S.line),key=`${kind}|${S.oop}|${S.ip}|${aggr}`,entry={oop:{},ip:{}},cnt={oop:{},ip:{}};let note=[],rangesOf=null;
  for(const root of ROOTS){const dir=path.join(root,id);if(!fs.existsSync(dir))continue;
   const fl=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))).filter(d=>d.version>=3&&d.handEv);if(!fl.length)continue;
   const tex=fl.map(d=>texture(d.flop)),w=new Array(fl.length).fill(0);
   for(const t of textures){let best=0,bd=Infinity;tex.forEach((x,i)=>{const d=distance(t,x);if(d<bd){bd=d;best=i;}});w[best]+=t.weight;}
   for(const side of ['oop','ip']){const acc=new Map();fl.forEach((d,f)=>{for(const [c,ev] of Object.entries(d.handEv[side])){const e=acc.get(c)??[0,0,0];e[0]+=w[f]*ev/d.spot.pot;e[1]+=w[f];e[2]++;acc.set(c,e);}});
    for(const [c,[sm,W,n]] of acc)if(W>0&&n>(cnt[side][c]??0)){entry[side][c]=Math.round(sm/W*10000)/10000;cnt[side][c]=n;}}
   if(!rangesOf&&fl[0].spot.chartRanges)rangesOf=fl[0].spot.chartRanges;note.push(path.basename(root)+':'+fl.length);}
  if(Object.keys(entry.oop).length){if(rangesOf)entry.ranges=rangesOf;out[key]=entry;report.push(`${id} → ${key}: ${note.join(' ')}`);}continue;}
 let files=[],used='';for(const root of ROOTS){const dir=path.join(root,id);if(!fs.existsSync(dir))continue;
  const fl=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))).filter(d=>d.version>=3&&d.handEv);
  if(fl.length>=MIN||(!files.length&&fl.length)){files=fl;used=root;if(fl.length>=MIN)break;}}
 if(!files.length)continue;
 const tex=files.map(d=>texture(d.flop)),w=new Array(files.length).fill(0);
 for(const t of textures){let best=0,bd=Infinity;tex.forEach((x,i)=>{const d=distance(t,x);if(d<bd){bd=d;best=i;}});w[best]+=t.weight;}
 const {kind,aggr}=kindOf(S.line),key=`${kind}|${S.oop}|${S.ip}|${aggr}`,entry={oop:{},ip:{}};
 for(const side of ['oop','ip']){const acc=new Map();
  files.forEach((d,f)=>{const pot=d.spot.pot;for(const [cls,ev] of Object.entries(d.handEv[side])){const e=acc.get(cls)??[0,0];e[0]+=w[f]*ev/pot;e[1]+=w[f];acc.set(cls,e);}});
  for(const [cls,[s,W]] of acc)if(W>0)entry[side][cls]=Math.round(s/W*10000)/10000;}
 out[key]=entry;report.push(`${id} → ${key}: ${files.length} flops from ${path.basename(used)}, classes oop ${Object.keys(entry.oop).length} ip ${Object.keys(entry.ip).length}`);
}
const file=arg('out',path.resolve(__dirname,'../../data/poker-gto/postflop-table.json'));
fs.writeFileSync(file,JSON.stringify({version:1,built:new Date().toISOString().slice(0,10),from:'solved flops (handEv / pot, texture-weighted)',table:out}));
console.log(report.join('\n'));console.log('saved',file,Object.keys(out).length,'spots');

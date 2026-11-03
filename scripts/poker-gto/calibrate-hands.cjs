// Fit the preflop model's equity realisation hand by hand from the version 3 flop solutions (2026/10/29).
// The preflop solver values a called pot as pot × share, where share = e·r·p(h) / (e·r·p(h) + (1-e)·r'·p(o)): e is the
// preflop all-in equity, r the position factor (out of position r < 1, in position 1) and p the class's playability.
// The flop files give, for every class in both ranges, what the hand is really worth (handEv / pot, averaged over the
// flops weighted by how often each texture occurs). This fits one playability per class and the out-of-position factor
// per pot kind and role to those numbers (weighted least squares, coordinate search, pulled gently towards the current
// formula), and writes data/poker-gto/realize-fit.json for: node scripts/poker-gto/preflop-solve.cjs --fit <file>
// Usage: node scripts/poker-gto/calibrate-hands.cjs [--out data/poker-gto/realize-fit.json] [--prior 0.02]
const fs=require('fs'),path=require('path');require('./common.cjs');
const {allTextures,texture,distance}=require(path.resolve(__dirname,'../../lib/poker/flop-subset.ts'));
const {playability,REALIZE_ROLE}=require(path.resolve(__dirname,'../../lib/poker/preflop-solver.ts'));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const root=path.resolve(__dirname,'../../public/poker-gto/flops');
const equity=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'),'utf8'));
const L=equity.labels,idx=new Map(L.map((l,i)=>[l,i])),R='23456789TJQKA',n=L.length;
const combosOf=l=>l.length===2?6:l[2]==='s'?4:12;
const cards=L.map(l=>{const a=R.indexOf(l[0]),b=R.indexOf(l[1]),out=[];for(let x=0;x<4;x++)for(let y=0;y<4;y++){if(a===b&&y<=x)continue;if(l[2]==='s'&&x!==y)continue;if(l[2]==='o'&&x===y)continue;out.push([a*4+x,b*4+y]);}return out;});
const pairN=new Float64Array(n*n);for(let i=0;i<n;i++)for(let j=0;j<n;j++){let c=0;for(const [p,q] of cards[i])for(const [r,s] of cards[j])if(p!==r&&p!==s&&q!==r&&q!==s)c++;pairN[i*n+j]=c;}
// Six-max spots by pot kind and by who is out of position: the preflop aggressor or the caller.
const KIND={srp:{call:['btn-bb','co-bb','hj-bb','utg-bb'],aggr:['sb-bb','co-btn','utg-btn']},'3bp':{aggr:['btn-bb-3bet','co-bb-3bet','utg-bb-3bet','btn-sb-3bet'],call:['co-btn-3bet']},'4bp':{call:['btn-bb-4bet'],aggr:[]}};
const textures=allTextures();
// Observations: per spot and side, the solved share of every class (texture-weighted), its weight and the opponent range.
const obs=[];
for(const [kind,roles] of Object.entries(KIND))for(const [role,spots] of Object.entries(roles))for(const spot of spots){
 const dir=path.join(root,spot);if(!fs.existsSync(dir))continue;
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))).filter(d=>d.version>=3&&d.handEv);
 if(!files.length)continue;
 const tex=files.map(d=>texture(d.flop)),w=new Array(files.length).fill(0);
 for(const t of textures){let best=0,bd=Infinity;tex.forEach((x,i)=>{const d=distance(t,x);if(d<bd){bd=d;best=i;}});w[best]+=t.weight;}
 const ranges=files[0].spot.chartRanges,pot=files[0].spot.pot;
 for(const side of ['oop','ip']){
  const other=side==='oop'?'ip':'oop',acc=new Map();
  files.forEach((d,f)=>{for(const [cls,ev] of Object.entries(d.handEv[side])){const e=acc.get(cls)??[0,0];e[0]+=w[f]*ev/pot;e[1]+=w[f];acc.set(cls,e);}});
  const opp=Object.entries(ranges[other]).map(([l,x])=>[idx.get(l),x]);
  for(const [cls,[s,W]] of acc){const h=idx.get(cls),reach=ranges[side][cls]??0;if(!(W>0)||!reach)continue;
   obs.push({spot,kind,role,side,h,share:s/W,weight:reach*combosOf(cls),opp});}
 }
}
if(!obs.length){console.log('no version 3 flop files with handEv yet');process.exit(0);}
// Model share for one observation under playabilities p and the out-of-position factor of its kind and role.
const play=Float64Array.from(L,playability),prior=Float64Array.from(play),factor={};
for(const k of Object.keys(KIND))factor[k]={...REALIZE_ROLE[k]};
function model(o){
 const f=factor[o.kind][o.role],rMe=o.side==='oop'?f:1,rOp=o.side==='oop'?1:f;let s=0,W=0;
 for(const [j,x] of o.opp){const c=pairN[o.h*n+j];if(!c)continue;const ww=x*c,e=equity.eq[o.h][j]/10000,a=e*rMe*play[o.h],b=(1-e)*rOp*play[j];s+=ww*a/(a+b);W+=ww;}
 return W>0?s/W:o.share;
}
const lambda=Number(arg('prior',0.02)),wsum=obs.reduce((s,o)=>s+o.weight,0);
const loss=()=>{let s=0;for(const o of obs){const d=model(o)-o.share;s+=o.weight*d*d;}let pen=0;for(let h=0;h<n;h++)pen+=(play[h]-prior[h])**2;return s/wsum+lambda*pen/n;};
const search=(get,set,lo,hi)=>{// golden-section on one parameter
 const g=(Math.sqrt(5)-1)/2;let a=lo,b=hi,c=b-g*(b-a),d=a+g*(b-a);set(c);let fc=loss();set(d);let fd=loss();
 for(let k=0;k<18;k++){if(fc<fd){b=d;d=c;fd=fc;c=b-g*(b-a);set(c);fc=loss();}else{a=c;c=d;fc=fd;d=a+g*(b-a);set(d);fd=loss();}}
 set(fc<fd?c:d);
};
const used=new Set();for(const o of obs){used.add(o.h);for(const [j] of o.opp)used.add(j);}
console.log(`observations ${obs.length} from ${new Set(obs.map(o=>o.spot)).size} spots · loss ${loss().toExponential(3)}`);
for(let sweep=0;sweep<4;sweep++){
 for(const [k,roles] of Object.entries(factor))for(const role of Object.keys(roles))if(obs.some(o=>o.kind===k&&o.role===role))search(()=>factor[k][role],v=>{factor[k][role]=v;},0.3,1.6);
 for(const h of used)search(()=>play[h],v=>{play[h]=v;},0.5,1.5);
 console.log(`sweep ${sweep+1} loss ${loss().toExponential(3)} factors ${JSON.stringify(factor)}`);
}
// How far off each spot side is now, before and after.
const out={fitted:new Date().toISOString().slice(0,10),from:'flop solutions version 3 (handEv)',spots:[...new Set(obs.map(o=>o.spot))],
 role:Object.fromEntries(Object.entries(factor).map(([k,v])=>[k,{call:+v.call.toFixed(3),aggr:+v.aggr.toFixed(3)}])),
 play:Object.fromEntries([...used].sort((a,b)=>a-b).map(h=>[L[h],+play[h].toFixed(3)]))};
const file=path.resolve(arg('out',path.resolve(__dirname,'../../data/poker-gto/realize-fit.json')));
fs.writeFileSync(file,JSON.stringify(out,null,1));console.log('wrote',file);

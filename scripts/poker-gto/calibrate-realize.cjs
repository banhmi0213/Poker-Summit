// Calibrate the preflop model's equity realisation from the flop solutions (2026/10/29).
// The preflop solver values a called pot as pot × share, share from all-in equity scaled by position (REALIZE) and
// playability. The flop solutions give the real share (EV / pot) for each spot's ranges. For each pot kind this finds the
// out-of-position factor (in position stays 1.0) that makes the model's share match the solved share, averaged over the
// spots of that kind, each flop weighted by how often its texture occurs.
// Usage: node scripts/poker-gto/calibrate-realize.cjs
const fs=require('fs'),path=require('path');require('./common.cjs');
const {allTextures,texture,distance}=require(path.resolve(__dirname,'../../lib/poker/flop-subset.ts'));
const {playability}=require(path.resolve(__dirname,'../../lib/poker/preflop-solver.ts'));
const root=path.resolve(__dirname,'../../public/poker-gto/flops');
const equity=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/poker-gto/preflop-equity.json'),'utf8'));
const L=equity.labels,idx=new Map(L.map((l,i)=>[l,i])),R='23456789TJQKA';
const combosOf=l=>l.length===2?6:l[2]==='s'?4:12;
const cards=L.map(l=>{const a=R.indexOf(l[0]),b=R.indexOf(l[1]),out=[];for(let x=0;x<4;x++)for(let y=0;y<4;y++){if(a===b&&y<=x)continue;if(l[2]==='s'&&x!==y)continue;if(l[2]==='o'&&x===y)continue;out.push([a*4+x,b*4+y]);}return out;});
const okPairs=new Map();const ok=(i,j)=>{const k=i*200+j;if(!okPairs.has(k)){let n=0;for(const [p,q] of cards[i])for(const [r,s] of cards[j])if(p!==r&&p!==s&&q!==r&&q!==s)n++;okPairs.set(k,n);}return okPairs.get(k);};
// Spots by pot kind and by who is out of position: the preflop aggressor ('aggr') or the caller ('call').
// One factor each: in position realises 1.0 either way, so the ratio is what the flop data can tell apart.
const KIND={srp:{call:['btn-bb','co-bb','hj-bb','utg-bb'],aggr:['sb-bb','co-btn','utg-btn']},'3bp':{aggr:['btn-bb-3bet','co-bb-3bet','utg-bb-3bet','btn-sb-3bet'],call:['co-btn-3bet']},'4bp':{call:['btn-bb-4bet']}};
const textures=allTextures();
function solvedShare(spot){
 const dir=path.join(root,spot);if(!fs.existsSync(dir))return null;
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))).filter(d=>d.version>=2&&d.ev);
 if(!files.length)return null;
 const tex=files.map(d=>texture(d.flop)),w=new Array(files.length).fill(0);
 for(const t of textures){let best=0,bd=Infinity;tex.forEach((x,i)=>{const d=distance(t,x);if(d<bd){bd=d;best=i;}});w[best]+=t.weight;}
 let s=0,W=0;files.forEach((d,i)=>{s+=w[i]*d.ev.oop/d.spot.pot;W+=w[i];});
 return {share:s/W,ranges:files[0].spot.chartRanges,flops:files.length};
}
function modelShare(ranges,rOop){
 let s=0,W=0;
 for(const [lo,wo] of Object.entries(ranges.oop)){const i=idx.get(lo),po=playability(lo);
  for(const [li,wi] of Object.entries(ranges.ip)){const j=idx.get(li),n=ok(i,j);if(!n)continue;const w=wo*wi*n,e=equity.eq[i][j]/10000,a=e*rOop*po,b=(1-e)*playability(li);s+=w*a/(a+b);W+=w;}}
 return s/W;
}
const out={};
for(const [kind,roles] of Object.entries(KIND))for(const [role,spots] of Object.entries(roles)){
 const rows=spots.map(sp=>({sp,...(solvedShare(sp)??{})})).filter(r=>r.share!==undefined);
 if(!rows.length)continue;
 // Bisection on the out-of-position factor so that the mean model share equals the mean solved share.
 const target=rows.reduce((s,r)=>s+r.share,0)/rows.length;let lo=0.2,hi=2;
 for(let k=0;k<40;k++){const mid=(lo+hi)/2,m=rows.reduce((s,r)=>s+modelShare(r.ranges,mid),0)/rows.length;if(m<target)lo=mid;else hi=mid;}
 const f=+((lo+hi)/2).toFixed(3);(out[kind]??={})[role]=f;
 console.log(kind,role,'oop factor',f);for(const r of rows)console.log(' ',r.sp.padEnd(12),'flops',r.flops,'solved OOP share',(r.share*100).toFixed(1)+'%','model',(modelShare(r.ranges,f)*100).toFixed(1)+'%');
}
console.log(JSON.stringify(out));

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
const textures=allTextures(),out={},report=[];
for(const [id,S] of Object.entries(SPOTS)){
 if(!S.line||(S.players??2)!==2||id.startsWith('hu-'))continue;
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

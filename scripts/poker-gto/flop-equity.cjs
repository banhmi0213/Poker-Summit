// Per-flop equity of every class against the opponent's solved range (2026/11/07, GTO rebuild).
// A handful of solved flops gives noisy class values (a class that pairs on many of the chosen flops looks too strong).
// postflop-table.cjs --ratio divides the solved value by this equity on the same flops (the realisation, which barely
// depends on how often the class hits) and multiplies by the class's equity over all flops.
// Usage: node scripts/poker-gto/flop-equity.cjs <dir with <spot>/<flop>.json> ... ; writes <flop>.eq.json next to each file.
const fs=require('fs'),path=require('path');require('./common.cjs');
const {evalCodes}=require(path.resolve(__dirname,'../../lib/poker/fast-eval.ts'));
const R='23456789TJQKA',S={s:0,h:1,d:2,c:3};
const code=t=>(R.indexOf(t[0]))*4+S[t[1]];
const LBL='AKQJT98765432',labels=[];for(let i=0;i<13;i++)for(let j=0;j<13;j++)labels.push(i===j?LBL[i]+LBL[j]:i<j?LBL[i]+LBL[j]+'s':LBL[j]+LBL[i]+'o');
const combosOf=l=>{const a=R.indexOf(l[0]),b=R.indexOf(l[1]),out=[];for(let x=0;x<4;x++)for(let y=0;y<4;y++){if(a===b&&y<=x)continue;if(l[2]==='s'&&x!==y)continue;if(l[2]==='o'&&x===y)continue;out.push([a*4+x,b*4+y]);}return out;};
const CL=labels.map(combosOf);
function equities(flop,heroW,oppW){
 const board=[0,2,4].map(i=>code(flop.slice(i,i+2))),dead=new Set(board);
 const all=[];labels.forEach((l,ci)=>{for(const [a,b] of CL[ci])if(!dead.has(a)&&!dead.has(b))all.push({a,b,ci,w:oppW[l]??0});});
 const rest=[];for(let c=0;c<52;c++)if(!dead.has(c))rest.push(c);
 const win=new Float64Array(all.length),mass=new Float64Array(all.length);
 const str=new Int32Array(all.length),order=new Int32Array(all.length);
 for(let i=0;i<rest.length;i++)for(let j=i+1;j<rest.length;j++){
  const t=rest[i],r=rest[j],b5=[...board,t,r];
  const idx=[];for(let k=0;k<all.length;k++){const c=all[k];if(c.a===t||c.a===r||c.b===t||c.b===r)continue;str[k]=evalCodes([c.a,c.b,...b5]);idx.push(k);}
  idx.sort((x,y)=>str[x]-str[y]);
  // Walk strength groups: below[] = opponent weight strictly weaker, per card too (to remove combos sharing a card).
  let below=0;const belowCard=new Float64Array(52);let g=0;
  while(g<idx.length){let e=g;while(e<idx.length&&str[idx[e]]===str[idx[g]])e++;
   let grp=0;const grpCard=new Float64Array(52);for(let q=g;q<e;q++){const c=all[idx[q]];grp+=c.w;grpCard[c.a]+=c.w;grpCard[c.b]+=c.w;}
   for(let q=g;q<e;q++){const k=idx[q],c=all[k];
    const lo=below-belowCard[c.a]-belowCard[c.b],tie=grp-grpCard[c.a]-grpCard[c.b]+c.w;
    win[k]+=lo+tie/2;}
   below+=grp;for(let q=g;q<e;q++){const c=all[idx[q]];belowCard[c.a]+=c.w;belowCard[c.b]+=c.w;}
   g=e;}
  // Total opponent weight compatible with each hero combo on this runout.
  let total=below;const tc=new Float64Array(52);for(const k of idx){const c=all[k];tc[c.a]+=c.w;tc[c.b]+=c.w;}
  for(const k of idx){const c=all[k];mass[k]+=total-tc[c.a]-tc[c.b]+c.w;}
 }
 const out={};labels.forEach((l,ci)=>{if(!(heroW[l]>0))return;let s=0,n=0;all.forEach((c,k)=>{if(c.ci===ci&&mass[k]>0){s+=win[k]/mass[k];n++;}});if(n)out[l]=Math.round(s/n*10000)/10000;});
 return out;
}
module.exports={equities,labels};
if(require.main===module){
 for(const dir of process.argv.slice(2))for(const spot of fs.readdirSync(dir)){const sd=path.join(dir,spot);if(!fs.statSync(sd).isDirectory())continue;
  for(const f of fs.readdirSync(sd).filter(f=>f.endsWith('.json')&&!f.endsWith('.eq.json'))){const of=path.join(sd,f.replace('.json','.eq.json'));if(fs.existsSync(of))continue;
   const d=JSON.parse(fs.readFileSync(path.join(sd,f),'utf8'));const r=d.spot.chartRanges;if(!r||!d.handEv)continue;const t=Date.now();
   const all1=Object.fromEntries(labels.map(l=>[l,1]));
   const eq={oop:equities(d.flop,all1,r.ip),ip:equities(d.flop,all1,r.oop)};
   fs.writeFileSync(of,JSON.stringify(eq));console.log(spot,f,((Date.now()-t)/1000).toFixed(1)+'s');}}
}

// Precompute heads-up flop solutions for the my-page flop browser (2026/10/26).
// Spots (ranges, pot, sizes) are in spots.cjs; ranges are standard reference ranges, written into the output.
// Usage: node scripts/poker-gto/flop-solve.cjs --spot btn-bb --flop Kh7d2c [--target 0.01] [--max-iters 300] [--max-minutes 300] [--out dir]
const fs=require('fs'),path=require('path');
require('./common.cjs'); // registers the .ts loader
const {PostflopSolver}=require(path.resolve(__dirname,'../../lib/poker/postflop-solver.ts'));
const {describe}=require(path.resolve(__dirname,'../../lib/poker/solver-view.ts'));

const RANKS='23456789TJQKA',SUITS='cdhs';
const code=s=>RANKS.indexOf(s[0].toUpperCase())*4+SUITS.indexOf(s[1].toLowerCase());
/** Range notation: "22+", "A2s+", "K8o+", "T6s+", "98o", "AKs", "77". Returns class labels. */
function expand(spec){
 const out=new Set();
 for(const tok of spec.split(',').map(t=>t.trim()).filter(Boolean)){
  if(tok.includes('-')){// "TT-QQ" or "A9s-AQs": every class from the first to the second
   const [from,to]=tok.split('-'),x=RANKS.indexOf(from[0]),lo=RANKS.indexOf(from[1]),hi=RANKS.indexOf(to[1]),kind=from[2]??'';
   if(from[0]===from[1]){for(let r=lo;r<=hi;r++)out.add(RANKS[r]+RANKS[r]);}else for(let r=lo;r<=hi;r++){const l=RANKS[x]+RANKS[r];if(kind!=='o')out.add(l+'s');if(kind!=='s')out.add(l+'o');}
   continue;
  }
  const plus=tok.endsWith('+'),t=plus?tok.slice(0,-1):tok,a=RANKS.indexOf(t[0]),b=RANKS.indexOf(t[1]),kind=t[2]??'';
  if(a<0||b<0)throw new Error('bad range token '+tok);
  if(a===b){for(let r=a;r<=(plus?12:a);r++)out.add(RANKS[r]+RANKS[r]);continue;}
  const [hi,lo]=a>b?[a,b]:[b,a];
  for(let r=lo;r<=(plus?hi-1:lo);r++){const l=RANKS[hi]+RANKS[r];if(kind!=='o')out.add(l+'s');if(kind!=='s')out.add(l+'o');}
 }
 return out;
}
function combos(labels,board){
 const out=[];
 for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){
  if(board.includes(a)||board.includes(b))continue;
  const [x,y]=a>b?[a,b]:[b,a],l=x>>2===y>>2?RANKS[x>>2]+RANKS[y>>2]:RANKS[x>>2]+RANKS[y>>2]+((x&3)===(y&3)?'s':'o');
  if(labels.has(l))out.push({c1:a,c2:b,weight:1});
 }
 return out;
}
const SPOTS=require('./spots.cjs');

function arg(name,def){const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:def;}
const flop=arg('flop');if(!flop||!/^([2-9TJQKA][cdhs]){3}$/i.test(flop))throw new Error('--flop like Kh7d2c is required');
const target=Number(arg('target',0.01)),maxIters=Number(arg('max-iters',300)),maxMinutes=Number(arg('max-minutes',300));
const spotId=arg('spot','btn-bb'),SPOT=SPOTS[spotId];if(!SPOT)throw new Error('--spot must be one of '+Object.keys(SPOTS).join(', '));
const outDir=path.join(arg('out',path.resolve(__dirname,'../../public/poker-gto/flops')),spotId);
const board=[0,2,4].map(i=>code(flop.slice(i,i+2)));
const range=(spec,exclude)=>{const l=expand(spec);for(const x of exclude?expand(exclude):[])l.delete(x);return l;};
// --oop / --ip override the ranges (used by the quick self-check).
const spot={board,pot:SPOT.pot,stack:SPOT.stack,...SPOT.sizes,ranges:[combos(arg('oop')?expand(arg('oop')):range(SPOT.oopRange,SPOT.oopExclude),board),combos(arg('ip')?expand(arg('ip')):range(SPOT.ipRange,SPOT.ipExclude),board)]};
const solver=new PostflopSolver(spot);
const t0=Date.now(),log=m=>console.log(`[${flop} ${((Date.now()-t0)/60000).toFixed(1)}min] ${m}`);
log(`${spotId} combos OOP(${SPOT.oop}) ${solver.sides[0].n} IP(${SPOT.ip}) ${solver.sides[1].n}`);
let expl=Infinity,checks=[];
while(solver.iterations<maxIters){
 solver.run(1);
 const it=solver.iterations,every=it<40?20:10;
 if(it%every===0||it>=maxIters){expl=solver.exploitability();checks.push([it,+(expl*100).toFixed(3)]);log(`iter ${it} exploitability ${(expl*100).toFixed(2)}% of pot · tables ${solver.tableCount()} · rss ${(process.memoryUsage().rss/1e9).toFixed(1)}GB`);
  if(expl<=target)break;}
 if((Date.now()-t0)/60000>maxMinutes){expl=solver.exploitability();checks.push([it,+(expl*100).toFixed(3)]);log('time limit');break;}
}
// Export every flop decision: per starting-hand class, reach weight (combos) and the share of each action.
const round=v=>Math.round(v*1000)/1000;
const nodes=[];
function visit(steps){
 const v=describe(solver,steps);if(v.kind!=='act'||v.street!=='flop')return null;
 const idx=nodes.length,node={path:steps,player:v.player,actions:v.actions.map(a=>({label:a.label,kind:a.kind})),total:v.total.map(round),
  classes:Object.fromEntries(Object.entries(v.classes).map(([l,e])=>[l,e.map(round)])),children:[]};
 nodes.push(node);node.children=v.actions.map((_,i)=>visit([...steps,i]));
 return idx;
}
visit([]);
const [ev0,ev1]=solver.values();
const out={version:1,flop,board,spot:{id:spotId,name:SPOT.name,pot:SPOT.pot,stack:SPOT.stack,oop:SPOT.oop,ip:SPOT.ip,note:SPOT.note,ranges:{oop:SPOT.oopRange,oopExclude:SPOT.oopExclude??'',ip:SPOT.ipRange,ipExclude:SPOT.ipExclude??''},sizes:SPOT.sizes},
 iterations:solver.iterations,exploitability:+(expl*100).toFixed(3),checks,ev:{oop:round(ev0),ip:round(ev1)},minutes:+((Date.now()-t0)/60000).toFixed(1),nodes};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,flop+'.json'),JSON.stringify(out));
log(`saved ${path.join(outDir,flop+'.json')} · ${nodes.length} flop decisions · exploitability ${out.exploitability}%`);

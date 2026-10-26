// Precompute heads-up flop solutions for the my-page flop browser (2026/10/26).
// Spot: single-raised pot, BTN opens 2.5BB and BB calls, 100BB stacks (pot 5.5BB, 97.5BB behind).
// Ranges are standard-looking reference ranges (not solved preflop); they are written into the output.
// Usage: node scripts/poker-gto/flop-solve.cjs --flop Kh7d2c [--target 0.01] [--max-iters 300] [--max-minutes 300] [--out dir]
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
const SPOT={
 name:'BTN対BB・シングルレイズ・100BB',
 pot:5.5,stack:97.5,
 btn:'22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,85s+,75s+,64s+,54s,A2o+,K8o+,Q9o+,J9o+,T8o+,98o,87o',
 // BB flats vs a 2.5x button open; QQ+, AK, A5s and A4s are 3-bet instead.
 bbDefend:'22+,A2s+,K2s+,Q2s+,J2s+,T4s+,95s+,84s+,74s+,63s+,53s+,43s,A2o+,K5o+,Q7o+,J7o+,T7o+,97o+,86o+,76o,65o',
 bb3bet:'QQ+,AKs,AKo,A5s,A4s',
 sizes:{betSizes:[0.33,0.75],raiseSizes:[3],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5},
};

function arg(name,def){const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:def;}
const flop=arg('flop');if(!flop||!/^([2-9TJQKA][cdhs]){3}$/i.test(flop))throw new Error('--flop like Kh7d2c is required');
const target=Number(arg('target',0.01)),maxIters=Number(arg('max-iters',300)),maxMinutes=Number(arg('max-minutes',300));
const outDir=arg('out',path.resolve(__dirname,'../../public/poker-gto/flops'));
const board=[0,2,4].map(i=>code(flop.slice(i,i+2)));
// --btn / --bb override the ranges (used by the quick self-check).
const bbLabels=expand(arg('bb',SPOT.bbDefend));if(!arg('bb'))for(const l of expand(SPOT.bb3bet))bbLabels.delete(l);
const spot={board,pot:SPOT.pot,stack:SPOT.stack,...SPOT.sizes,ranges:[combos(bbLabels,board),combos(expand(arg('btn',SPOT.btn)),board)]};
const solver=new PostflopSolver(spot);
const t0=Date.now(),log=m=>console.log(`[${flop} ${((Date.now()-t0)/60000).toFixed(1)}min] ${m}`);
log(`combos OOP(BB) ${solver.sides[0].n} IP(BTN) ${solver.sides[1].n}`);
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
const out={version:1,flop,board,spot:{name:SPOT.name,pot:SPOT.pot,stack:SPOT.stack,oop:'BB',ip:'BTN',ranges:{btn:SPOT.btn,bbDefend:SPOT.bbDefend,bb3bet:SPOT.bb3bet},sizes:SPOT.sizes},
 iterations:solver.iterations,exploitability:+(expl*100).toFixed(3),checks,ev:{oop:round(ev0),ip:round(ev1)},minutes:+((Date.now()-t0)/60000).toFixed(1),nodes};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,flop+'.json'),JSON.stringify(out));
log(`saved ${path.join(outDir,flop+'.json')} · ${nodes.length} flop decisions · exploitability ${out.exploitability}%`);

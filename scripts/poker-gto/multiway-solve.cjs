// Precompute three-way flop solutions (2026/10/29). Called by flop-solve.cjs for spots with players:3.
// Same output layout as the heads-up files (version 2, multiway: true): nodes along the flop tree with, per starting-hand
// class, [reach weight, action shares]. After the flop the pot is shared by equity over every runout (depth limit).
const fs=require('fs'),path=require('path');require('./common.cjs');
const {MultiwaySolver}=require(path.resolve(__dirname,'../../lib/poker/multiway-solver.ts'));
const {classOf}=require(path.resolve(__dirname,'../../lib/poker/solver-view.ts'));
const {chartSpot}=require('./chart-ranges.cjs');
const SPOTS=require('./spots.cjs');
function arg(name,def){const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:def;}
const RANKS='23456789TJQKA',SUITS='cdhs',code=s=>RANKS.indexOf(s[0].toUpperCase())*4+SUITS.indexOf(s[1].toLowerCase());
const flop=arg('flop'),spotId=arg('spot'),SPOT=SPOTS[spotId];
if(!SPOT||SPOT.players!==3)throw new Error('--spot must be a three-way spot');
const target=Number(arg('target',0.005)),maxIters=Number(arg('max-iters',300)),maxMinutes=Number(arg('max-minutes',300));
const outDir=path.join(arg('out',path.resolve(__dirname,'../../public/poker-gto/flops')),spotId);
const board=[0,2,4].map(i=>code(flop.slice(i,i+2)));
const chart=chartSpot(SPOT.line,SPOT.chart,3);
if(chart.order.join()!==SPOT.order.join())throw new Error(`chart order ${chart.order} differs from the spot ${SPOT.order}`);
const combos=w=>{const out=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++){if(board.includes(a)||board.includes(b))continue;const x=w[classOf(a,b)];if(x>0)out.push({c1:a,c2:b,weight:x});}return out;};
const solver=new MultiwaySolver({board,pot:chart.pot,stack:chart.stack,ranges:chart.ranges.map(combos),...SPOT.sizes,depthLimit:true});
const t0=Date.now(),log=m=>console.log(`[${flop} ${((Date.now()-t0)/60000).toFixed(1)}min] ${m}`);
log(`${spotId} combos ${SPOT.order.map((p,i)=>`${p} ${solver.sides[i].n}`).join(' · ')}`);
let expl=[Infinity],checks=[];
while(solver.iterations<maxIters){
 solver.run(1);const it=solver.iterations;
 if(it%10===0||it>=maxIters){expl=solver.exploitability();const worst=Math.max(...expl);checks.push([it,+(worst*100).toFixed(3)]);log(`iter ${it} best-response gain ${expl.map(x=>(x*100).toFixed(2)+'%').join(' / ')} · rss ${(process.memoryUsage().rss/1e9).toFixed(1)}GB`);if(worst<=target)break;}
 if((Date.now()-t0)/60000>maxMinutes){expl=solver.exploitability();checks.push([it,+(Math.max(...expl)*100).toFixed(3)]);log('time limit');break;}
}
const round=v=>Math.round(v*1000)/1000,nodes=[];
function visit(node,reach,steps){
 if(node.kind!=='act')return null;
 const p=node.player,side=solver.sides[p],st=solver.strategy(node,true),k=node.actions.length,acc={},tot=new Array(k).fill(0);let all=0;
 for(let h=0;h<side.n;h++){const r=reach[p][h];if(r<=1e-12)continue;const l=classOf(side.c1[h],side.c2[h]),e=acc[l]??=new Array(k+1).fill(0);e[0]+=r;all+=r;for(let a=0;a<k;a++){e[a+1]+=r*st[h*k+a];tot[a]+=r*st[h*k+a];}}
 for(const e of Object.values(acc))for(let a=1;a<=k;a++)e[a]/=e[0];
 const idx=nodes.length,out={path:steps,player:p,actions:node.actions.map(a=>({label:a.label,kind:a.kind})),total:tot.map(x=>round(all>0?x/all:0)),
  classes:Object.fromEntries(Object.entries(acc).map(([l,e])=>[l,e.map(round)])),children:[]};
 nodes.push(out);
 out.children=node.actions.map((_,a)=>{const next=reach.map((r,q)=>{if(q!==p)return r;const y=new Float64Array(r.length);for(let h=0;h<r.length;h++)y[h]=r[h]*st[h*k+a];return y;});return visit(node.children[a],next,[...steps,a]);});
 return idx;
}
visit(solver.tree,solver.sides.map(s=>Float64Array.from(s.w)),[]);
const ev=solver.values();
const out={version:3,multiway:true,flop,board,spot:{id:spotId,name:SPOT.name,pot:chart.pot,stack:chart.stack,order:SPOT.order,note:SPOT.note,line:SPOT.line,chartRanges:chart.ranges,sizes:SPOT.sizes,
 model:'3人のポット：フロップの打ち合いを計算し、そのあとは残りのカードを全部配ったときの勝率で分配。相手2人どうしのカードのかぶりは無視。'},
 iterations:solver.iterations,exploitability:+(Math.max(...expl)*100).toFixed(3),checks,ev:Object.fromEntries(SPOT.order.map((p,i)=>[p,round(ev[i])])),minutes:+((Date.now()-t0)/60000).toFixed(1),nodes};
fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,flop+'.json'),JSON.stringify(out));
log(`saved ${path.join(outDir,flop+'.json')} · ${nodes.length} flop decisions · best-response gain ${out.exploitability}%`);

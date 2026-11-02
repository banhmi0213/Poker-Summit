// Parallel flop solves (2026/10/29). The turn cards are split between worker threads: each worker keeps its own copy
// of the solver and owns the turn and river strategy tables of its cards, so nothing below the turn is shared. The main
// thread keeps the flop decisions and, at every turn chance node, hands the opponent's reach to the workers and adds up
// what they return (SharedArrayBuffer + Atomics, so the main thread simply waits). The result is the same solve as on
// one thread, only faster.
// Usage: const stop=parallelize(solver,spot,workers); ...solve...; stop();
const path=require('path'),{Worker,isMainThread,workerData}=require('worker_threads');

const CTRL=8; // per worker: [request seq, done seq, index, hero, mode, iteration, -, -]
const MODES=['train','br','avg'];

function parallelize(solver,spot,count){
 const n=Math.max(solver.sides[0].n,solver.sides[1].n),cards=solver.deck;
 const ctrl=new Int32Array(new SharedArrayBuffer(4*CTRL*count)),opp=new Float64Array(new SharedArrayBuffer(8*n)),res=new Float64Array(new SharedArrayBuffer(8*n*count));
 const workers=[];
 for(let w=0;w<count;w++){
  const mine=cards.filter((_,i)=>i%count===w);
  const worker=new Worker(__filename,{workerData:{spot,cards:mine,w,ctrl:ctrl.buffer,opp:opp.buffer,res:res.buffer,n}});
  worker.on('error',e=>{console.error('worker',w,e);process.exit(1);});
  workers.push(worker);
 }
 let seq=0;
 solver.turnHook=(index,hero,o,mode,iteration)=>{
  seq++;opp.fill(0);opp.set(o);
  for(let w=0;w<count;w++){const b=w*CTRL;ctrl[b+2]=index;ctrl[b+3]=hero;ctrl[b+4]=MODES.indexOf(mode);ctrl[b+5]=iteration;Atomics.store(ctrl,b,seq);Atomics.notify(ctrl,b);}
  for(let w=0;w<count;w++){const b=w*CTRL+1;while(Atomics.load(ctrl,b)!==seq)Atomics.wait(ctrl,b,Atomics.load(ctrl,b),60000);}
  const hn=solver.sides[hero].n,sum=new Float64Array(hn);
  for(let w=0;w<count;w++){const off=w*n;for(let h=0;h<hn;h++)sum[h]+=res[off+h];}
  return sum;
 };
 return ()=>{solver.turnHook=undefined;for(const w of workers)w.terminate();};
}

if(!isMainThread){
 require('./common.cjs');
 const {PostflopSolver}=require(path.resolve(__dirname,'../../lib/poker/postflop-solver.ts'));
 const {spot,cards,w,n}=workerData,ctrl=new Int32Array(workerData.ctrl),opp=new Float64Array(workerData.opp),res=new Float64Array(workerData.res);
 const solver=new PostflopSolver(spot),b=w*CTRL;let last=0;
 for(;;){
  Atomics.wait(ctrl,b,last);const seq=Atomics.load(ctrl,b);if(seq===last)continue;last=seq;
  const hero=ctrl[b+3],v=solver.turnShare(ctrl[b+2],hero,opp,MODES[ctrl[b+4]],ctrl[b+5],cards);
  res.set(v,w*n);Atomics.store(ctrl,b+1,seq);Atomics.notify(ctrl,b+1);
 }
}
module.exports={parallelize};

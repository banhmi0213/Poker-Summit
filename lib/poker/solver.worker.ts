/** Runs the postflop solver off the main thread so the page stays responsive during long turn solves.
 * Messages in: solve / stop / view. Messages out: progress / done / view / error. */
import {PostflopSolver,type SolverSpot} from './postflop-solver';
import {describe,type ViewStep} from './solver-view';

export type SolverRequest={type:'solve';spot:SolverSpot;target:number;maxIterations:number}|{type:'stop'}|{type:'view';id:number;steps:ViewStep[]};
export type SolverReply={type:'progress';iterations:number;exploitability:number|null}|{type:'done';iterations:number;exploitability:number}
 |{type:'view';id:number;view:ReturnType<typeof describe>}|{type:'error';message:string};

let solver:PostflopSolver|null=null,run=0;
const scope=self as unknown as {postMessage(m:SolverReply):void;onmessage:((e:MessageEvent<SolverRequest>)=>void)|null};
const post=(m:SolverReply)=>scope.postMessage(m);
scope.onmessage=e=>{
 const m=e.data;
 try{
  if(m.type==='solve'){
   const id=++run,s=new PostflopSolver(m.spot);solver=s;
   // Check accuracy every few iterations (one check costs about one iteration); stop at the target or the cap.
   const every=s.street==='turn'?10:50;let last:number|null=null;
   const step=()=>{
    if(run!==id)return;
    const t0=Date.now();do s.run(1);while(Date.now()-t0<150&&s.iterations%every!==0);
    if(s.iterations%every===0||s.iterations>=m.maxIterations){last=s.exploitability();
     if(last<=m.target||s.iterations>=m.maxIterations){post({type:'done',iterations:s.iterations,exploitability:last});return;}}
    post({type:'progress',iterations:s.iterations,exploitability:last});setTimeout(step,0);
   };
   setTimeout(step,0);
  }else if(m.type==='stop'){
   if(solver){run++;post({type:'done',iterations:solver.iterations,exploitability:solver.exploitability()});}
  }else if(m.type==='view'){
   if(solver)post({type:'view',id:m.id,view:describe(solver,m.steps)});
  }
 }catch(err){post({type:'error',message:err instanceof Error?err.message:String(err)});}
};

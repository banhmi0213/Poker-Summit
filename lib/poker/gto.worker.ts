/** Browser worker for the practice table's GTO CPUs and the hand-history GTO review: loads the GTO data on demand and
 * runs decideGto / reviewGto (turn/river solves take seconds) off the main thread.
 * Messages in: decide, advise, review. Messages out: decision, advice, review. */
import {decideGto,type GtoData,type GtoView,type GtoDecision,type PreflopData} from './gto-bot';
import {adviseGto,reviewGto,reviewLive,reviewRanges,summarizeDeviation,type GtoRange,type DeviationSummary,type LiveDecision,type LiveReview,type GtoAdvice,type GtoReview,type GtoReviewHand} from './gto-review';
import type {FlopData} from './gto-spots';
import {exploreTurn,type ExploreResult} from './gto-explore';

export type GtoRequest={type:'decide';id:number;view:GtoView;budgetMs:number}|{type:'advise';id:number;view:GtoView;budgetMs:number}|{type:'reviewLive';id:number;items:LiveDecision[];budgetMs:number}|{type:'review';id:number;hand:GtoReviewHand;budgetMs:number}|{type:'deviation';id:number;hands:GtoReviewHand[]}|{type:'explore';id:number;spot:string;flop:string;path:number[];turn:string;steps:number[];budgetMs:number};
export type GtoReply={type:'decision';id:number;decision:GtoDecision}|{type:'advice';id:number;advice:GtoAdvice}|{type:'liveReview';id:number;reviews:LiveReview[]}|{type:'review';id:number;reviews:GtoReview[];others?:{index:number;range:GtoRange}[]}|{type:'deviation';id:number;summary:DeviationSummary}|{type:'explore';id:number;result:ExploreResult}|{type:'error';id:number;message:string};

const scope=self as unknown as {postMessage(m:GtoReply):void;onmessage:((e:MessageEvent<GtoRequest>)=>void)|null};
const flops=new Map<string,FlopData|null>(),missing=new Set<string>();
let base:Promise<{preflop:PreflopData;preflopHu?:PreflopData;preflopDepths?:Record<number,PreflopData>;flopIndex:Record<string,string[]>}>|null=null;
const json=async<T,>(url:string):Promise<T|null>=>{try{const r=await fetch(url);return r.ok?await r.json() as T:null;}catch{return null;}};
function load(){
 if(!base)base=(async()=>{const preflop=await json<PreflopData>('/poker-gto/preflop.json');if(!preflop)throw Error('GTO data unavailable');return {preflop,preflopHu:(await json<PreflopData>('/poker-gto/preflop-hu.json'))??undefined,preflopDepths:Object.fromEntries((await Promise.all([60,40,20,10].map(async d=>[d,await json<PreflopData>(`/poker-gto/preflop-${d}bb.json`)] as const))).filter(([,c])=>c)) as Record<number,PreflopData>,flopIndex:(await json<Record<string,string[]>>('/poker-gto/flops/index.json'))??{}};})();
 return base;
}
scope.onmessage=async e=>{
 const m=e.data;
 // Turn and river from the flop page (2026/10/30).
 if(m.type==='explore'){try{const k=m.spot+'/'+m.flop;if(!flops.has(k))flops.set(k,await json<FlopData>(`/poker-gto/flops/${k}.json`));const file=flops.get(k);
  scope.postMessage({type:'explore',id:m.id,result:file?exploreTurn(file,m.path,m.turn,m.steps,m.budgetMs):{error:'フロップのデータが読み込めませんでした。'}});}
  catch(error){scope.postMessage({type:'error',id:m.id,message:error instanceof Error?error.message:String(error)});}return;}
 if(m.type!=='decide'&&m.type!=='review'&&m.type!=='advise'&&m.type!=='reviewLive'&&m.type!=='deviation')return;
 try{
  const b=await load();
  const data:GtoData={...b,flop(spot,flop){const k=spot+'/'+flop;if(flops.has(k))return flops.get(k)!;missing.add(k);return null;}};
  const run=()=>m.type==='decide'?decideGto(m.view,data,Math.random,m.budgetMs):m.type==='advise'?adviseGto(m.view,data,m.budgetMs):m.type==='reviewLive'?reviewLive(m.items,data,m.budgetMs):m.type==='deviation'?summarizeDeviation(m.hands,data):{reviews:reviewGto(m.hand,data,m.budgetMs),others:reviewRanges(m.hand,data,Math.min(m.budgetMs,800))};
  let d=run();
  // A flop file was needed but not loaded yet: fetch it and decide again.
  for(let i=0;i<5&&missing.size>0;i++){const keys=[...missing];missing.clear();
   await Promise.all(keys.map(async k=>{flops.set(k,await json<FlopData>(`/poker-gto/flops/${k}.json`));}));
   d=run();}
  scope.postMessage(m.type==='decide'?{type:'decision',id:m.id,decision:d as GtoDecision}:m.type==='advise'?{type:'advice',id:m.id,advice:d as GtoAdvice}:m.type==='reviewLive'?{type:'liveReview',id:m.id,reviews:d as LiveReview[]}:m.type==='deviation'?{type:'deviation',id:m.id,summary:d as DeviationSummary}:{type:'review',id:m.id,...(d as {reviews:GtoReview[];others:{index:number;range:GtoRange}[]})});
 }catch(error){scope.postMessage({type:'error',id:m.id,message:error instanceof Error?error.message:String(error)});}
};

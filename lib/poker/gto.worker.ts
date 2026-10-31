/** Browser worker for the practice table's GTO CPUs and the hand-history GTO review: loads the GTO data on demand and
 * runs decideGto / reviewGto (turn/river solves take seconds) off the main thread.
 * Messages in: decide, advise, spot, flags, review. Messages out: decision, advice, spot, review. */
import {decideGto,preflopEvById,type GtoData,type GtoView,type GtoDecision,type PreflopData,type PreflopEvFile} from './gto-bot';
import {adviseGto,flagHand,trainerSpot,reviewGto,reviewLive,reviewRanges,summarizeDeviation,type GtoRange,type DeviationSummary,type LiveDecision,type LiveReview,type GtoAdvice,type TrainerSpot,type HandFlags,type GtoReview,type GtoReviewHand} from './gto-review';
import type {FlopData} from './gto-spots';
import {reachSpot,trainerView,type TrainerHand,type TrainerMode} from './gto-trainer';
import {exploreTurn,type ExploreResult} from './gto-explore';
import {icmPushFold,type IcmResult,type IcmSpot} from './icm';

export type GtoRequest={type:'decide';id:number;view:GtoView;budgetMs:number}|{type:'advise';id:number;view:GtoView;budgetMs:number}|{type:'reviewLive';id:number;items:LiveDecision[];budgetMs:number}|{type:'review';id:number;hand:GtoReviewHand;budgetMs:number}|{type:'deviation';id:number;hands:GtoReviewHand[]}|{type:'explore';id:number;spot:string;flop:string;path:number[];turn:string;steps:number[];budgetMs:number}|{type:'icm';id:number;spot:IcmSpot}|{type:'spot';id:number;view:GtoView;budgetMs:number}|{type:'trainerStart';id:number;mode:TrainerMode;seed:number;buttonIndex:number;tries:number}|{type:'flags';id:number;hands:GtoReviewHand[];streets:('preflop'|'flop'|'turn'|'river')[];budgetMs:number};
export type GtoReply={type:'decision';id:number;decision:GtoDecision}|{type:'advice';id:number;advice:GtoAdvice}|{type:'liveReview';id:number;reviews:LiveReview[]}|{type:'review';id:number;reviews:GtoReview[];others?:{index:number;range:GtoRange}[]}|{type:'deviation';id:number;summary:DeviationSummary}|{type:'explore';id:number;result:ExploreResult}|{type:'icm';id:number;result:{icm:IcmResult;chip:IcmResult}}|{type:'spot';id:number;spot:TrainerSpot}|{type:'trainerStart';id:number;hand:TrainerHand|null}|{type:'flags';id:number;flags:HandFlags[]}|{type:'error';id:number;message:string};

const scope=self as unknown as {postMessage(m:GtoReply):void;onmessage:((e:MessageEvent<GtoRequest>)=>void)|null};
const flops=new Map<string,FlopData|null>(),missing=new Set<string>();
let base:Promise<{preflop:PreflopData;preflopHu?:PreflopData;preflopDepths?:Record<number,PreflopData>;flopIndex:Record<string,string[]>;preflopEv?:GtoData['preflopEv']}>|null=null;
const json=async<T,>(url:string):Promise<T|null>=>{try{const r=await fetch(url);return r.ok?await r.json() as T:null;}catch{return null;}};
function load(){
 if(!base)base=(async()=>{const preflop=await json<PreflopData>('/poker-gto/preflop.json');if(!preflop)throw Error('GTO data unavailable');return {preflop,preflopHu:(await json<PreflopData>('/poker-gto/preflop-hu.json'))??undefined,preflopDepths:Object.fromEntries((await Promise.all([60,40,20,10].map(async d=>[d,await json<PreflopData>(`/poker-gto/preflop-${d}bb.json`)] as const))).filter(([,c])=>c)) as Record<number,PreflopData>,flopIndex:(await json<Record<string,string[]>>('/poker-gto/flops/index.json'))??{},preflopEv:preflopEvById(await json<PreflopEvFile>('/poker-gto/preflop-ev.json'))};})();
 return base;
}
/** 「GTOと対戦」の練習の始め方: try deals until the hero reaches the chosen spot (everyone plays GTO until then). */
function findSpot(mode:TrainerMode,seed:number,buttonIndex:number,tries:number,data:GtoData){
 for(let k=0;k<tries;k++){const h=reachSpot(seed+k,buttonIndex,mode,(x,id)=>decideGto(trainerView(x,id)!,data,Math.random,0).action);if(h)return h;}
 return null;
}
scope.onmessage=async e=>{
 const m=e.data;
 // ICM push/fold calculator (2026/10/30): with prizes and with chips only.
 if(m.type==='icm'){try{const equity=(await import('@/data/poker-gto/preflop-equity.json')).default as {labels:string[];eq:number[][]};
  scope.postMessage({type:'icm',id:m.id,result:{icm:icmPushFold(m.spot,equity),chip:icmPushFold({...m.spot,chipEv:true},equity)}});}
  catch(error){scope.postMessage({type:'error',id:m.id,message:error instanceof Error?error.message:String(error)});}return;}
 // Turn and river from the flop page (2026/10/30).
 if(m.type==='explore'){try{const k=m.spot+'/'+m.flop;if(!flops.has(k))flops.set(k,await json<FlopData>(`/poker-gto/flops/${k}.json`));const file=flops.get(k);
  scope.postMessage({type:'explore',id:m.id,result:file?exploreTurn(file,m.path,m.turn,m.steps,m.budgetMs):{error:'フロップのデータが読み込めませんでした。'}});}
  catch(error){scope.postMessage({type:'error',id:m.id,message:error instanceof Error?error.message:String(error)});}return;}
 if(m.type!=='decide'&&m.type!=='spot'&&m.type!=='trainerStart'&&m.type!=='flags'&&m.type!=='review'&&m.type!=='advise'&&m.type!=='reviewLive'&&m.type!=='deviation')return;
 try{
  const b=await load();
  const data:GtoData={...b,flop(spot,flop){const k=spot+'/'+flop;if(flops.has(k))return flops.get(k)!;missing.add(k);return null;}};
  const run=()=>m.type==='decide'?decideGto(m.view,data,Math.random,m.budgetMs):m.type==='spot'?trainerSpot(m.view,data,m.budgetMs):m.type==='trainerStart'?findSpot(m.mode,m.seed,m.buttonIndex,m.tries,data):m.type==='flags'?m.hands.map(h=>flagHand(h,data,m.streets,m.budgetMs)):m.type==='advise'?adviseGto(m.view,data,m.budgetMs):m.type==='reviewLive'?reviewLive(m.items,data,m.budgetMs):m.type==='deviation'?summarizeDeviation(m.hands,data):{reviews:reviewGto(m.hand,data,m.budgetMs),others:reviewRanges(m.hand,data,Math.min(m.budgetMs,800))};
  let d=run();
  // A flop file was needed but not loaded yet: fetch it and decide again.
  for(let i=0;i<5&&missing.size>0;i++){const keys=[...missing];missing.clear();
   await Promise.all(keys.map(async k=>{flops.set(k,await json<FlopData>(`/poker-gto/flops/${k}.json`));}));
   d=run();}
  scope.postMessage(m.type==='decide'?{type:'decision',id:m.id,decision:d as GtoDecision}:m.type==='spot'?{type:'spot',id:m.id,spot:d as TrainerSpot}:m.type==='trainerStart'?{type:'trainerStart',id:m.id,hand:d as TrainerHand|null}:m.type==='flags'?{type:'flags',id:m.id,flags:d as HandFlags[]}:m.type==='advise'?{type:'advice',id:m.id,advice:d as GtoAdvice}:m.type==='reviewLive'?{type:'liveReview',id:m.id,reviews:d as LiveReview[]}:m.type==='deviation'?{type:'deviation',id:m.id,summary:d as DeviationSummary}:{type:'review',id:m.id,...(d as {reviews:GtoReview[];others:{index:number;range:GtoRange}[]})});
 }catch(error){scope.postMessage({type:'error',id:m.id,message:error instanceof Error?error.message:String(error)});}
};

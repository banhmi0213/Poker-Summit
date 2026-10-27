/** Browser worker for the practice table's GTO CPUs: loads the GTO data on demand and runs decideGto
 * (turn/river solves take seconds) off the main thread. Messages in: decide. Messages out: decision. */
import {decideGto,type GtoData,type GtoView,type GtoDecision,type PreflopData} from './gto-bot';
import type {FlopData} from './gto-spots';

export type GtoRequest={type:'decide';id:number;view:GtoView;budgetMs:number};
export type GtoReply={type:'decision';id:number;decision:GtoDecision}|{type:'error';id:number;message:string};

const scope=self as unknown as {postMessage(m:GtoReply):void;onmessage:((e:MessageEvent<GtoRequest>)=>void)|null};
const flops=new Map<string,FlopData|null>(),missing=new Set<string>();
let base:Promise<{preflop:PreflopData;flopIndex:Record<string,string[]>}>|null=null;
const json=async<T,>(url:string):Promise<T|null>=>{try{const r=await fetch(url);return r.ok?await r.json() as T:null;}catch{return null;}};
function load(){
 if(!base)base=(async()=>{const preflop=await json<PreflopData>('/poker-gto/preflop.json');if(!preflop)throw Error('GTO data unavailable');return {preflop,flopIndex:(await json<Record<string,string[]>>('/poker-gto/flops/index.json'))??{}};})();
 return base;
}
scope.onmessage=async e=>{
 const m=e.data;if(m.type!=='decide')return;
 try{
  const b=await load();
  const data:GtoData={...b,flop(spot,flop){const k=spot+'/'+flop;if(flops.has(k))return flops.get(k)!;missing.add(k);return null;}};
  let d=decideGto(m.view,data,Math.random,m.budgetMs);
  // A flop file was needed but not loaded yet: fetch it and decide again.
  for(let i=0;i<3&&missing.size>0;i++){const keys=[...missing];missing.clear();
   await Promise.all(keys.map(async k=>{flops.set(k,await json<FlopData>(`/poker-gto/flops/${k}.json`));}));
   d=decideGto(m.view,data,Math.random,m.budgetMs);}
  scope.postMessage({type:'decision',id:m.id,decision:d});
 }catch(error){scope.postMessage({type:'error',id:m.id,message:error instanceof Error?error.message:String(error)});}
};

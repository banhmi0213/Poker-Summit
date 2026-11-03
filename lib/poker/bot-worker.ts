/** Worker thread for staging CPU hands: the Monte Carlo bots never block the live tables' event loop. */
import {parentPort} from 'node:worker_threads';
import {BotTable,type BotAnomaly} from './bot-hands';
import {ringTerms} from './tournament-hand';
import {loadGtoData} from './gto-data-node';
import type {HandHistory} from './hand-history';

export type BotConfig={enabled:boolean;tables:number;pauseMs:number};
export type BotBatch={type:'batch';hands:{table:number;history:HandHistory;actions:number;ms:number}[];anomalies:(BotAnomaly&{table:number})[];avgMs:number;maxMs:number;sources:Record<string,number>};
const port=parentPort;
if(port){
 const gto=loadGtoData();
 let config:BotConfig={enabled:false,tables:1,pauseMs:1000};const tables:BotTable[]=[];
 let sources:Record<string,number>={},hands:BotBatch['hands']=[],anomalies:BotBatch['anomalies']=[],times:number[]=[],sent=Date.now(),timer:ReturnType<typeof setTimeout>|null=null;
 const flush=()=>{if(!hands.length&&!anomalies.length)return;
  const batch:BotBatch={type:'batch',hands,anomalies,avgMs:times.reduce((s,v)=>s+v,0)/Math.max(1,times.length),maxMs:Math.max(0,...times),sources};
  port.postMessage(batch);hands=[];anomalies=[];times=[];sources={};sent=Date.now();};
 const round=()=>{
  timer=null;if(!config.enabled){flush();return;}
  while(tables.length<config.tables)tables.push(new BotTable(tables.length+1,ringTerms,gto));
  for(const t of tables.slice(0,config.tables)){
   const r=t.play();times.push(r.ms);for(const [k,n] of Object.entries(r.sources))sources[k]=(sources[k]??0)+n;
   if(r.history)hands.push({table:t.table,history:r.history,actions:r.actions,ms:Math.round(r.ms)});
   for(const a of r.anomalies)anomalies.push({...a,table:t.table});
  }
  if(hands.length>=200||Date.now()-sent>=10000)flush();
  timer=setTimeout(round,config.pauseMs);
 };
 port.on('message',(m:{type:'config';config:BotConfig}|{type:'stop'})=>{
  if(m.type==='stop'){if(timer)clearTimeout(timer);flush();port.postMessage({type:'stopped'});return;}
  config=m.config;if(config.enabled&&!timer)timer=setTimeout(round,0);
 });
}

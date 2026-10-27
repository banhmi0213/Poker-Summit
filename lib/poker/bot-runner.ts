/** Staging-only: runs CPU hands in a worker and stores them (owner request 2026/10/27: hand collection plus
 * bug/load checks). Controlled from the database (poker_private.bot_settings) so it can be switched on/off
 * without a deploy. Refuses to run against the production project.
 */
import {Worker} from 'node:worker_threads';
import path from 'node:path';
import type {BotBatch,BotConfig} from './bot-worker';
type Rpc=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
const PRODUCTION_REF='tjmeqnzvuoguoffltxrp';
export function parseBotSettings(value:unknown):BotConfig{
 const v=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;
 const int=(x:unknown,min:number,max:number,fallback:number)=>Number.isSafeInteger(x)&&Number(x)>=min&&Number(x)<=max?Number(x):fallback;
 return {enabled:v.enabled===true,tables:int(v.tables,1,6,1),pauseMs:int(v.pause_ms,0,60000,1000)};
}
export class BotRunner{
 #worker:Worker|null=null;#poll:ReturnType<typeof setInterval>|null=null;#config:BotConfig={enabled:false,tables:1,pauseMs:1000};#closed=false;#saving=Promise.resolve();
 constructor(private options:{url:string;rpc:Rpc;log:(event:Record<string,unknown>)=>void;workerFile?:string;pollMs?:number}){}
 get allowed(){return !this.options.url.includes(PRODUCTION_REF);}
 async start(){
  if(!this.allowed||this.#closed)return;
  await this.#refresh();
  this.#poll=setInterval(()=>{void this.#refresh();},this.options.pollMs??60000);this.#poll.unref?.();
 }
 async #refresh(){
  try{const {data,error}=await this.options.rpc('poker_bot_settings',{});if(error)throw error;this.#apply(parseBotSettings(data));}
  catch{this.options.log({type:'poker_bot_settings_failed'});}
 }
 #apply(config:BotConfig){
  if(this.#closed)return;const changed=JSON.stringify(config)!==JSON.stringify(this.#config);this.#config=config;
  if(config.enabled&&!this.#worker){
   const w=new Worker(this.options.workerFile??path.join(__dirname,'bot-worker.js'));this.#worker=w;
   w.on('message',(m:BotBatch)=>{if(m?.type==='batch')this.#save(m);});
   w.on('error',()=>{this.options.log({type:'poker_bot_worker_failed'});this.#worker=null;});
   w.on('exit',()=>{if(this.#worker===w)this.#worker=null;});
   this.options.log({type:'poker_bot_started',tables:config.tables});
  }
  if(this.#worker&&(changed||config.enabled))this.#worker.postMessage({type:'config',config});
 }
 #save(batch:BotBatch){
  const payload={hands:batch.hands,anomalies:batch.anomalies,stats:{sources:batch.sources,avg_ms:batch.avgMs,max_ms:batch.maxMs,rss_mb:Math.round(process.memoryUsage().rss/1048576)}};
  this.#saving=this.#saving.then(async()=>{try{const {error}=await this.options.rpc('poker_bot_record',{p_batch:payload});if(error)throw error;}catch{this.options.log({type:'poker_bot_record_failed',hands:batch.hands.length});}
   if(batch.anomalies.length)this.options.log({type:'poker_bot_anomaly',kinds:[...new Set(batch.anomalies.map(a=>a.kind))]});});
 }
 async close(){
  this.#closed=true;if(this.#poll)clearInterval(this.#poll);
  const w=this.#worker;this.#worker=null;
  if(w){await new Promise<void>(resolve=>{const done=setTimeout(resolve,2000);w.once('message',()=>{clearTimeout(done);resolve();});w.postMessage({type:'stop'});});await w.terminate();}
  await this.#saving;
 }
}

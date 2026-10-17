/** Browser transport only. No dealing, betting engine, member identity or persistence keys. */
import type {ScheduledTournamentRoom} from './scheduled-tournament-room';
import type {BettingAction} from './betting';
export type PlayerSnapshot=ReturnType<ScheduledTournamentRoom['publicSnapshot']>;
type Command={handId:string;revision:number;actionId:string;action:BettingAction};
export class PlayerClientError extends Error {
 constructor(readonly status:number){super(status===0||status>=500?'通信結果を確認できません。':'接続または操作を確認してください。');}
}
export class PokerPlayerClient {
 #connection:string|null=null;#state:PlayerSnapshot|null=null;#pending:Command|null=null;#queue:Promise<unknown>=Promise.resolve();#closed=false;
 #endpoint:string;#token:()=>Promise<string|null>;#fetch:typeof fetch;#id:()=>string;
 constructor(options:{endpoint:string;token:()=>Promise<string|null>;fetch?:typeof fetch;id?:()=>string}){
  if(!/^\/api\/poker\/rooms\/[a-f0-9-]{36}$/i.test(options.endpoint))throw Error('Invalid player endpoint');
  this.#endpoint=options.endpoint;this.#token=options.token;this.#fetch=options.fetch??fetch;this.#id=options.id??(()=>crypto.randomUUID());
 }
 get state(){return this.#state?structuredClone(this.#state):null;}
 get pending(){return this.#pending!==null;}
 #serial<T>(run:()=>Promise<T>):Promise<T>{const job=this.#queue.then(()=>{if(this.#closed)throw new PlayerClientError(0);return run();});this.#queue=job.catch(()=>{});return job;}
 async #send(body:unknown,connected=false):Promise<any>{
  const token=await this.#token();if(!token){this.#state=null;this.#connection=null;throw new PlayerClientError(401);}
  if(this.#closed)throw new PlayerClientError(0);
  if(connected&&!this.#connection)throw new PlayerClientError(409);
  let response:Response,value:any;
  try{response=await this.#fetch(this.#endpoint,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(connected?{'X-Poker-Connection':this.#connection!}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});value=await response.json();}catch{throw new PlayerClientError(0);}
  if(this.#closed)throw new PlayerClientError(0);
  if(!response.ok||value?.ok!==true){if([401,403,404,409].includes(response.status)){this.#state=null;if(body&&typeof body==='object'&&(body as {type:string}).type==='state')this.#connection=null;}throw new PlayerClientError(response.ok?0:response.status);}
  return value.result;
 }
 #accept(state:PlayerSnapshot){if(!state||!Number.isSafeInteger(state.revision)||!Number.isSafeInteger(state.serverNow)||!Array.isArray(state.seats))throw new PlayerClientError(0);this.#state=structuredClone(state);return this.state!;}
 /** Explicit reconnect prevents two tabs repeatedly stealing each other's connection. */
 connect(){return this.#serial(async()=>{this.#state=null;this.#connection=null;const result=await this.#send({type:'connect'});if(typeof result?.connectionId!=='string')throw new PlayerClientError(0);this.#connection=result.connectionId;return this.#accept(result.state);});}
 seat(seat:number){return this.#serial(async()=>{if(this.#pending)throw new PlayerClientError(409);this.#state=null;return this.#accept(await this.#send({type:'seat',seat}));});}
 refresh(){return this.#serial(async()=>this.#accept(await this.#send({type:'state'},true)));}
 spectate(){return this.#serial(async()=>{if(this.#pending)throw new PlayerClientError(409);this.#state=null;this.#connection=null;return this.#accept(await this.#send({type:'spectate'}));});}
 act(action:BettingAction){const captured=structuredClone(action);return this.#serial(async()=>{
  if(this.#pending||!this.#state?.hand?.legal||!this.#connection)throw new PlayerClientError(409);
  this.#pending={handId:this.#state.hand.handId,revision:this.#state.hand.revision,actionId:this.#id(),action:captured};
  return this.#submit();
 });}
 retry(){return this.#serial(async()=>{if(!this.#pending)throw new PlayerClientError(409);return this.#submit();});}
 async #submit(){
  try{const result=await this.#send({type:'act',command:this.#pending},true);const state=this.#accept(result.state);this.#pending=null;return state;}
  catch(error){if(error instanceof PlayerClientError&&error.status>=400&&error.status<500&&![408,429].includes(error.status))this.#pending=null;throw error;}
 }
 disconnect(){return this.#serial(async()=>{if(this.#pending)throw new PlayerClientError(409);try{return await this.#send({type:'disconnect'},true);}finally{this.#state=null;this.#connection=null;}});}
 /** Local teardown is synchronous; late network responses cannot repopulate private cards. */
 close(){this.#closed=true;this.#connection=null;this.#state=null;this.#pending=null;}
}

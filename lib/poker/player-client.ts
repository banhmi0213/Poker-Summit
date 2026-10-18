/** Browser transport only. No dealing, betting engine, member identity or persistence keys. */
import type {ScheduledTournamentRoom} from './scheduled-tournament-room';
import type {BettingAction} from './betting';
export type PlayerSnapshot=ReturnType<ScheduledTournamentRoom['publicSnapshot']>;
type Command={handId:string;revision:number;actionId:string;action:BettingAction};
export class PlayerClientError extends Error {
 constructor(readonly status:number){super(status===0||status>=500?'通信結果を確認できません。':'接続または操作を確認してください。');}
}
export class PokerPlayerClient {
 #stopUpdates:(()=>void)|null=null;#generation=0;#disconnecting=false;
 #connection:string|null=null;#state:PlayerSnapshot|null=null;#pending:Command|null=null;#queue:Promise<unknown>=Promise.resolve();#closed=false;
 #endpoint:string;#token:()=>Promise<string|null>;#fetch:typeof fetch;#id:()=>string;
 constructor(options:{endpoint:string;token:()=>Promise<string|null>;fetch?:typeof fetch;id?:()=>string}){
  if(!/^\/api\/poker\/rooms\/[a-f0-9-]{36}$/i.test(options.endpoint))throw Error('Invalid player endpoint');
  this.#endpoint=options.endpoint;this.#token=options.token;this.#fetch=options.fetch??globalThis.fetch.bind(globalThis);this.#id=options.id??(()=>crypto.randomUUID());
 }
 get state(){return this.#state?structuredClone(this.#state):null;}
 get pending(){return this.#pending!==null;}
 #serial<T>(run:()=>Promise<T>):Promise<T>{const job=this.#queue.then(()=>{if(this.#closed)throw new PlayerClientError(0);return run();});this.#queue=job.catch(()=>{});return job;}
 async #send(body:unknown,connected=false):Promise<any>{
  const generation=this.#generation;const token=await this.#token();if(!token){this.#state=null;this.#connection=null;throw new PlayerClientError(401);}
  if(this.#closed||generation!==this.#generation)throw new PlayerClientError(0);
  if(connected&&!this.#connection)throw new PlayerClientError(this.#pending?0:409);
  let response:Response,value:any;
  try{response=await this.#fetch(this.#endpoint,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(connected?{'X-Poker-Connection':this.#connection!}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});value=await response.json();}catch{throw new PlayerClientError(0);}
  if(this.#closed||generation!==this.#generation)throw new PlayerClientError(0);
  if(!response.ok||value?.ok!==true){if([401,403,404,409].includes(response.status)){this.#state=null;if(body&&typeof body==='object'&&(body as {type:string}).type==='state')this.#connection=null;}throw new PlayerClientError(response.ok?0:response.status);}
  return value.result;
 }
 #accept(state:PlayerSnapshot){if(!state||!Number.isSafeInteger(state.revision)||!Number.isSafeInteger(state.serverNow)||!Array.isArray(state.seats))throw new PlayerClientError(0);this.#state=structuredClone(state);return this.state!;}
 /** Explicit reconnect prevents two tabs repeatedly stealing each other's connection. */
 join(){return this.#serial(async()=>{this.#stopUpdates?.();this.#state=null;this.#connection=null;const result=await this.#send({type:'join'});if(typeof result?.connectionId!=='string')throw new PlayerClientError(0);this.#connection=result.connectionId;return this.#accept(result.state);});}
 connect(){return this.#serial(async()=>{this.#stopUpdates?.();this.#state=null;this.#connection=null;const result=await this.#send({type:'connect'});if(typeof result?.connectionId!=='string')throw new PlayerClientError(0);this.#connection=result.connectionId;return this.#accept(result.state);});}
 seat(seat:number){return this.#serial(async()=>{if(this.#pending)throw new PlayerClientError(409);this.#state=null;return this.#accept(await this.#send({type:'seat',seat}));});}
 refresh(){return this.#serial(async()=>this.#accept(await this.#send({type:'state'},true)));}
 spectate(){return this.#serial(async()=>{if(this.#pending)throw new PlayerClientError(409);this.#stopUpdates?.();this.#state=null;this.#connection=null;return this.#accept(await this.#send({type:'spectate'}));});}
 act(action:BettingAction){const captured=structuredClone(action);return this.#serial(async()=>{
  if(this.#pending||!this.#state?.hand?.legal||!this.#connection)throw new PlayerClientError(409);
  this.#pending={handId:this.#state.hand.handId,revision:this.#state.hand.revision,actionId:this.#id(),action:captured};
  return this.#submit();
 });}
 timeBank(){return this.#serial(async()=>{if(this.#pending||!this.#state?.hand?.legal||!this.#connection)throw new PlayerClientError(409);const result=await this.#send({type:'time-bank',handId:this.#state.hand.handId,revision:this.#state.hand.revision},true);return this.#accept(result.state);});}
 retry(){return this.#serial(async()=>{if(!this.#pending)throw new PlayerClientError(409);return this.#submit();});}
 async #submit(){
  try{const result=await this.#send({type:'act',command:this.#pending},true);const state=this.#accept(result.state);this.#pending=null;return state;}
  catch(error){if(error instanceof PlayerClientError&&error.status>=400&&error.status<500&&![408,429].includes(error.status))this.#pending=null;throw error;}
 }
 disconnect(){return this.#serial(async()=>{if(this.#pending)throw new PlayerClientError(409);this.#disconnecting=true;try{return await this.#send({type:'disconnect'},true);}finally{this.#disconnecting=false;this.#stopUpdates?.();this.#state=null;this.#connection=null;}});}
 /** Optional invalidation channel. State still comes from serialized authenticated HTTP reads. */
 watch(eventsOrigin:string,onChange:()=>void,onLost:()=>void,Socket:typeof WebSocket=WebSocket){return this.#serial(async()=>{
  this.#stopUpdates?.();const origin=new URL(eventsOrigin);
  if(origin.origin!==eventsOrigin||origin.username||origin.password||!(origin.protocol==='wss:'||origin.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))throw Error('Invalid event origin');
  const token=await this.#token(),connection=this.#connection;if(!token||!connection||this.#closed)throw new PlayerClientError(401);
  let disposed=false,ready=false,lastRevision=-1;const socket=new Socket(eventsOrigin+this.#endpoint+'/events');
  const stop=()=>{if(disposed)return;disposed=true;clearTimeout(deadline);socket.close();if(this.#stopUpdates===stop)this.#stopUpdates=null;};
  const lost=()=>{if(disposed)return;stop();if(this.#disconnecting)return;this.#generation++;this.#connection=null;this.#state=null;onLost();};
  const deadline=setTimeout(lost,10000);
  socket.onopen=()=>{if(!disposed)socket.send(JSON.stringify({type:'subscribe',token,connectionId:connection}));};
  socket.onmessage=event=>{if(disposed)return;try{const value=JSON.parse(event.data);if(!value||Object.keys(value).sort().join(',')!=='revision,type'||!['ready','changed'].includes(value.type)||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision<lastRevision)throw Error();if(!ready&&value.type!=='ready')throw Error();ready=true;lastRevision=value.revision;clearTimeout(deadline);onChange();}catch{lost();}};
  socket.onerror=lost;socket.onclose=lost;this.#stopUpdates=stop;return stop;
 });}
 /** Local teardown is synchronous; late network responses cannot repopulate private cards. */
 close(){this.#closed=true;this.#stopUpdates?.();this.#connection=null;this.#state=null;this.#pending=null;}
}

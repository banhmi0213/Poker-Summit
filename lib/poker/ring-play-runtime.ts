/** Server-only ring runner. Each operation restores a committed deal; DB CAS and
 * deadline checks fence overlapping processes. No browser-supplied seat or stack. */
import {RingHandOwner,SupabaseRingStore,type RingStore,type RingContext,RingCommandError} from './ring-hand-owner';
import type {KeyRing} from './room-persistence';
import {runoutDuration,RUNOUT_STEP_MS} from './presentation-timing';
import type {RingAdmissionStore} from './ring-lobby-handler';
import {RingAdmissionConflict} from './ring-lobby-handler';
import type {RingLobbyCommand,RingLobbyState} from './ring-admission';
import type {RingPlayView} from './ring-play-state';
import {parseHandCommand} from './authoritative-hand';
type Client={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
export type RingPlayMeta={context:RingContext;now:string;changedAt:string|null;lastHandId:string|null;completedAt:string|null;runoutFrom:0|3|4|5|null;ready:string[]};
export interface RingPlayStore extends RingStore {meta(table:string):Promise<RingPlayMeta>;tables(limit:number):Promise<string[]>;ready(member:string,reservation:string):Promise<void>;ping(member:string,table:string):Promise<void>;cashout(member:string,reservation:string,request:string):Promise<unknown>;timeout:boolean;from:number}
const time=(s:string|null)=>{const v=s===null?NaN:Date.parse(s);if(!Number.isFinite(v))throw Error('Ring clock unavailable');return v;};
export class SupabaseRingPlayStore extends SupabaseRingStore implements RingPlayStore{
 timeout=false;from=0;
 constructor(private playClient:Client){super(playClient);}
 private async playRPC(name:string,args:Record<string,unknown>){const {data,error}=await this.playClient.rpc(name,args);if(error)throw Error('Ring play persistence unavailable');return data;}
 async meta(table:string){return await this.playRPC('poker_ring_play_meta',{p_table:table}) as RingPlayMeta;}
 async tables(limit:number){return await this.playRPC('poker_ring_play_tables',{p_limit:limit}) as string[];}
 async ready(member:string,reservation:string){await this.playRPC('poker_ring_play_ready',{p_member:member,p_reservation:reservation});}
 async ping(member:string,table:string){await this.playRPC('poker_ring_play_ping',{p_member:member,p_table:table});}
 override async begin(r:Parameters<RingStore['begin']>[0]){return Number(await this.playRPC('poker_ring_play_begin',{p_table:r.tableId,p_hand:r.handId,p_roster:r.roster,p_terms:r.terms,p_sealed:r.sealed,p_result:r.result}));}
 override async write(r:Parameters<RingStore['write']>[0]){return Number(await this.playRPC('poker_ring_play_write',{p_hand:r.handId,p_expected:r.expected,p_write:r.writeId,p_sealed:r.sealed,p_result:r.result,p_timeout:this.timeout,p_from:this.from}));}
}
export function ringPresentation(hand:ReturnType<RingHandOwner['snapshot']>,meta:RingPlayMeta):RingPlayView['hand']{
 const state=structuredClone(hand);if(!state.result)return state;
 const elapsed=Math.max(0,time(meta.now)-time(meta.completedAt)),from=meta.runoutFrom??0;
 const duration=state.result.showdown?runoutDuration(from):0;
 if(elapsed<duration){const visible=[from,...[3,4,5].filter(n=>n>from)][Math.floor(elapsed/RUNOUT_STEP_MS)]??5;
  const payouts=state.result.payouts;state.board=state.board.slice(0,visible);state.street=visible===0?'preflop':visible===3?'flop':visible===4?'turn':'river';
  state.pot=Object.values(payouts).reduce((a,b)=>a+b,0);state.players=state.players.map(p=>({...p,stack:p.stack-(payouts[p.id]??0)}));state.result=null;
 }
 state.legal=null;state.toAct=null;return state;
}
export class RingPlayRuntime {
 #queues=new Map<string,Promise<unknown>>();#tables=new Set<string>();#prepared=new Map<string,Awaited<ReturnType<typeof RingHandOwner.prepare>>>();
 #preparedContext=new Map<string,string>();
 #timer:ReturnType<typeof setInterval>|null=null;#scan:Promise<void>|null=null;#closed=false;#started=false;
 constructor(private options:{store:()=>RingPlayStore;keys:KeyRing;maxTables?:number;diagnostic?:(event:{type:string})=>void}){}
 private get limit(){return this.options.maxTables??128;}
 private async serial<T>(table:string,work:()=>Promise<T>):Promise<T>{if(this.#closed)throw Error('Ring runtime closed');if(!this.#tables.has(table)){if(this.#tables.size>=this.limit)throw Error('Ring capacity reached');this.#tables.add(table);}const prior=this.#queues.get(table)??Promise.resolve();const task=prior.catch(()=>{}).then(work);this.#queues.set(table,task);try{return await task;}finally{if(this.#queues.get(table)===task)this.#queues.delete(table);}}
 private async advance(table:string,store:RingPlayStore){let meta=await store.meta(table);const c=meta.context;
  if(c.activeHandId){const owner=await RingHandOwner.restore(store,c.activeHandId,this.options.keys),s=owner.snapshot(null);if(!s.toAct||s.result)throw Error('Invalid active ring hand');
   if(time(meta.now)>=time(meta.changedAt)+30000){const member=c.seats.find(p=>'seat-'+p.seat===s.toAct);if(!member)throw Error('Missing actor');const legal=owner.snapshot(member.memberId).legal;if(!legal)throw Error('Missing legal actions');store.timeout=true;store.from=s.board.length;await owner.act(member.memberId,{handId:s.handId,revision:s.revision,actionId:'timeout-'+owner.version,action:{type:legal.check?'check':'fold'}});meta=await store.meta(table);}
   return meta;
  }
  if(meta.completedAt&&time(meta.now)-time(meta.completedAt)<15000)return meta;
  // Zero-stack seats have no chips left to wager. Close their reservation once
  // presentation is over; a new buy-in always requires explicit confirmation.
  for(const p of c.seats.filter(p=>p.stack===0))await store.cashout(p.memberId,p.reservationId,crypto.randomUUID());
  if(c.seats.some(p=>p.stack===0))meta=await store.meta(table);
  const seats=meta.context.seats;
  if(meta.context.published&&seats.length>=2&&seats.every(p=>p.stack>0&&meta.ready.includes(p.reservationId))){
   const fingerprint=JSON.stringify([meta.context.seats,meta.context.terms,meta.context.buttonSeat]);if(this.#preparedContext.get(table)!==fingerprint){this.#prepared.delete(table);this.#preparedContext.delete(table);}let prepared=this.#prepared.get(table);if(!prepared){prepared=await RingHandOwner.prepare(store,table,this.options.keys);this.#prepared.set(table,prepared);this.#preparedContext.set(table,fingerprint);}
   try{await prepared.commit();this.#prepared.delete(table);}catch(error){
    // The old begin may have committed without its ACK. Never prepare a second
    // deal until the DB tells us which hand owns this table.
    const after=await store.meta(table);if(after.context.activeHandId||after.lastHandId===prepared.handId)this.#prepared.delete(table);else if(!after.ready.length)this.#prepared.delete(table);throw error;
   }
   meta=await store.meta(table);
  }
  return meta;
 }
 async tick(table:string){return this.serial(table,()=>this.advance(table,this.options.store()));}
 async view(table:string,member:string):Promise<RingPlayView|null>{return this.serial(table,async()=>{const store=this.options.store();await store.ping(member,table);const meta=await this.advance(table,store),seat=meta.context.seats.find(p=>p.memberId===member);if(!seat||!meta.lastHandId)return null;
   const owner=await RingHandOwner.restore(store,meta.lastHandId,this.options.keys);let hand;try{hand=owner.snapshot(member);}catch{return null;}
   return {viewerSeat:'seat-'+seat.seat,serverNow:time(meta.now),deadline:hand.result?null:time(meta.changedAt)+30000,hand:ringPresentation(hand,meta),...(hand.result?.showdown?{runout:{from:meta.runoutFrom??0,startedAt:time(meta.completedAt),final:hand}}:{})};
  });}
 async ready(member:string,reservation:string,table:string){return this.serial(table,async()=>{const store=this.options.store();await store.ready(member,reservation);await this.advance(table,store);});}
 async act(member:string,table:string,input:unknown){const command=parseHandCommand(input);return this.serial(table,async()=>{const store=this.options.store();const meta=await store.meta(table),saved=await store.load(command.handId);if(!saved||saved.tableId!==table)throw new RingAdmissionConflict();
   const own=meta.context.seats.find(p=>p.memberId===member);if(!own||!saved.seats.some(p=>p.memberId===member&&p.reservationId===own.reservationId))throw new RingAdmissionConflict();
   const owner=await RingHandOwner.restore(store,command.handId,this.options.keys);store.from=owner.snapshot(member).board.length;
   // Existing receipts remain replayable after their original deadline. A new
   // late command is rejected by the SQL clock fence, then the runner times out.
   try{await owner.act(member,command);}catch(error){if(error instanceof RingCommandError)throw new RingAdmissionConflict();throw error;}
  });}
 private scan(){if(this.#closed||this.#scan)return this.#scan;this.#scan=(async()=>{const tables=await this.options.store().tables(this.limit);if(!Array.isArray(tables)||tables.length>this.limit||tables.some(t=>typeof t!=='string'||!/^[-a-f0-9]{36}$/i.test(t))||new Set(tables).size!==tables.length)throw Error('Invalid ring discovery');for(const table of this.#tables){if(!tables.includes(table)&&!this.#queues.has(table)){this.#tables.delete(table);this.#prepared.delete(table);this.#preparedContext.delete(table);}}for(const table of tables){if(this.#tables.size<this.limit||this.#tables.has(table))this.#tables.add(table);}await Promise.allSettled([...this.#tables].map(table=>this.tick(table).catch(()=>{this.options.diagnostic?.({type:'ring_tick_retry'});})));})().finally(()=>{this.#scan=null;});return this.#scan;}
 async start(){if(this.#closed)throw Error('Ring runtime closed');if(this.#started)return;await this.scan();if(this.#closed)return;this.#started=true;this.#timer=setInterval(()=>{void this.scan()?.catch(()=>this.options.diagnostic?.({type:'ring_scan_retry'}));},1000);}
 async close(){this.#closed=true;if(this.#timer)clearInterval(this.#timer);await this.#scan;await Promise.allSettled([...this.#queues.values()]);this.#prepared.clear();}
}
/** Auth has already resolved the member; all money changes still use SQL. */
export class PlayingRingAdmissionStore implements RingAdmissionStore{
 constructor(private base:RingAdmissionStore,private runtime:RingPlayRuntime){}
 async state(member:string,table:string|null){let state=await this.base.state(member,table);if(table&&state.membership?.tableId===table&&state.membership.playEnabled){const play=await this.runtime.view(table,member);state=await this.base.state(member,table);return {...state,play:state.membership?play:null};}return state;}
 async change(member:string,command:RingLobbyCommand):Promise<RingLobbyState>{
  if(command.type==='ready'||command.type==='act'){const state=await this.base.state(member,null),own=state.membership;
   if(!own||own.status!=='seated'||own.reservationId!==command.reservationId)throw new RingAdmissionConflict();
   if(command.type==='ready')await this.runtime.ready(member,own.reservationId,own.tableId);else {if(!own.playEnabled)throw new RingAdmissionConflict();await this.runtime.act(member,own.tableId,command.command);}
   return this.state(member,own.tableId);
  }
  return this.base.change(member,command);
 }
}

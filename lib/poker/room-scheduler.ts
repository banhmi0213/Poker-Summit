/** Explicitly started process-local timer driver. No server/process is launched on import. */
import {RoomControlUnavailable,roomUUID} from './room-directory';
import type {TournamentRoomRegistry} from './tournament-room-registry';
type Timer={set:(callback:()=>void,delay:number)=>unknown;clear:(handle:unknown)=>void};
type Job={timer:unknown|null;inflight:Promise<void>|null;again:boolean;readFailures:number};
type Options={now?:()=>number;pollMs?:number;maxRooms?:number;timer?:Timer;onError?:(roomId:string)=>void;onDiagnostic?:(event:{roomId:string;event:'control-read-retry'|'scheduler-stopped';attempt:number;reason:'control-read-unavailable'|'advance-failed'})=>void};
export class RoomScheduler {
 #running=new Set<Promise<void>>();
 #jobs=new Map<string,Job>();#registry:Pick<TournamentRoomRegistry,'advance'>;#now:()=>number;#poll:number;#limit:number;#timer:Timer;#onError:(id:string)=>void;#report:NonNullable<Options['onDiagnostic']>;
 constructor(registry:Pick<TournamentRoomRegistry,'advance'>,options:Options={}){
  this.#report=options.onDiagnostic??(()=>{});this.#registry=registry;this.#now=options.now??Date.now;this.#poll=options.pollMs??1000;this.#limit=options.maxRooms??128;this.#onError=options.onError??(()=>{});
  if(!Number.isSafeInteger(this.#poll)||this.#poll<10||this.#poll>60000||!Number.isSafeInteger(this.#limit)||this.#limit<1||this.#limit>10000)throw new Error('Invalid scheduler limits');
  this.#timer=options.timer??{set:(fn,ms)=>setTimeout(fn,ms),clear:h=>clearTimeout(h as ReturnType<typeof setTimeout>)};
 }
 get activeRooms(){return this.#jobs.size;}
 start(id:string){const roomId=roomUUID(id);if(this.#jobs.has(roomId))return this.wake(roomId);if(this.#jobs.size>=this.#limit)return Promise.reject(new Error('Scheduler capacity reached'));
  const job:Job={timer:null,inflight:null,again:false,readFailures:0};this.#jobs.set(roomId,job);return this.#pump(roomId,job);
 }
 /** Optional connection/action notification. Polling is the fallback, not wall-clock authority. */
 wake(id:string){const roomId=roomUUID(id),job=this.#jobs.get(roomId);if(!job)return Promise.reject(new Error('Room scheduler is not started'));
  if(job.timer!==null){this.#timer.clear(job.timer);job.timer=null;}if(job.inflight){job.again=true;return job.inflight;}return this.#pump(roomId,job);
 }
 #pump(id:string,job:Job):Promise<void>{
  if(this.#jobs.get(id)!==job)return Promise.resolve();
  if(job.inflight)return job.inflight;
  const running=Promise.resolve().then(async()=>{
   if(this.#jobs.get(id)!==job)return;
   const result=await this.#registry.advance(id);job.readFailures=0;
   if(this.#jobs.get(id)!==job)return;
   if(!result||result.event==='finished'||result.event==='disabled'){this.stop(id);return;}
   const now=this.#now();if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid scheduler clock');
   const until=result?.nextWakeAt===null||result?.nextWakeAt===undefined?this.#poll:Math.max(1,result.nextWakeAt-now);
   const delay=job.again?1:Math.min(this.#poll,until);job.again=false;
   const handle=this.#timer.set(()=>{if(job.timer!==handle)return;job.timer=null;void this.#pump(id,job).catch(()=>{});},delay);job.timer=handle;
  }).catch(error=>{
   if(this.#jobs.get(id)===job){
    // Only a failed read BEFORE owner.advance is retryable. Saves, malformed
    // metadata and partial mutations must still stop; never replay a write here.
    const readFailure=error instanceof RoomControlUnavailable;
    if(readFailure&&++job.readFailures<=3){
     try{this.#report({roomId:id,event:'control-read-retry',attempt:job.readFailures,reason:'control-read-unavailable'});}catch{}
     const handle=this.#timer.set(()=>{if(job.timer!==handle)return;job.timer=null;void this.#pump(id,job).catch(()=>{});},1000*2**(job.readFailures-1));job.timer=handle;return;
    }
    this.stop(id);try{this.#report({roomId:id,event:'scheduler-stopped',attempt:job.readFailures,reason:readFailure?'control-read-unavailable':'advance-failed'});}catch{}
    try{this.#onError(id);}catch{/* reporting never resumes a failed room */}
   }
   throw new Error('Room scheduler stopped; operator recovery required');
  }).finally(()=>{this.#running.delete(running);if(job.inflight===running)job.inflight=null;});
  job.inflight=running;this.#running.add(running);return running;
 }
 stop(id:string){const roomId=roomUUID(id),job=this.#jobs.get(roomId);if(!job)return;this.#jobs.delete(roomId);if(job.timer!==null)this.#timer.clear(job.timer);job.timer=null;}
 /** Stop future ticks and await the durable decisions already accepted. */
 async drain(){const running=[...this.#running];this.close();await Promise.allSettled(running);}
 close(){for(const id of this.#jobs.keys())this.stop(id);}
}

/** Trusted single-process startup coordinator. Construction never starts timers.
 * IDs come from server configuration/discovery, never from a player request.
 * Missing/corrupt rooms are quarantined until explicit operator recovery.
 */
import {roomUUID} from './room-directory';
import type {TournamentRoomRegistry} from './tournament-room-registry';
import {RoomScheduler} from './room-scheduler';
type Registry=Pick<TournamentRoomRegistry,'owner'|'advance'|'recover'>;
type Driver=Pick<RoomScheduler,'start'|'stop'|'close'>;
export class RoomRuntime {
 #registry:Registry;#driver:Driver;#limit:number;#closed=false;
 #pending=new Map<string,Promise<void>>();#active=new Set<string>();#failed=new Set<string>();
 constructor(registry:Registry,options:{maxRooms?:number;driver?:Driver}={}){
  this.#registry=registry;this.#limit=options.maxRooms??128;
  if(!Number.isSafeInteger(this.#limit)||this.#limit<1||this.#limit>10000)throw new Error('Invalid runtime limit');
  this.#driver=options.driver??new RoomScheduler(registry,{maxRooms:this.#limit,onError:id=>{this.#active.delete(id);this.#failed.add(id);}});
 }
 get health(){return {closed:this.#closed,active:this.#active.size,pending:this.#pending.size,failed:this.#failed.size};}
 /** Validate the entire bounded manifest before any I/O. An error on one room
  * does not stop independent rooms; only aggregate counts are returned. */
 async start(ids:readonly string[]){
  if(this.#closed)throw new Error('Runtime closed');
  if(!Array.isArray(ids)||ids.length>this.#limit)throw new Error('Invalid startup manifest');
  const rooms=ids.map(roomUUID);if(new Set(rooms).size!==rooms.length)throw new Error('Duplicate startup room');
  await Promise.allSettled(rooms.map(id=>this.activate(id)));return this.health;
 }
 /** Also call after a durable new-room binding is confirmed. Never provisions. */
 activate(raw:string):Promise<void>{
  const id=roomUUID(raw);if(this.#closed)return Promise.reject(new Error('Runtime closed'));
  const pending=this.#pending.get(id);if(pending)return pending;
  if(this.#failed.has(id))return Promise.reject(new Error('Operator recovery required'));
  if(this.#active.has(id))return Promise.resolve();
  if(this.#active.size+this.#pending.size>=this.#limit)return Promise.reject(new Error('Runtime capacity reached'));
  const task=Promise.resolve().then(async()=>{
   const owner=await this.#registry.owner(id);
   if(this.#closed)return;
   if(!owner||owner.health.status!=='ready')throw new Error('Room unavailable');
   await this.#driver.start(id);
   if(this.#closed){this.#driver.stop(id);return;}
   this.#active.add(id);
  }).catch(()=>{if(!this.#closed){this.#active.delete(id);this.#failed.add(id);}throw new Error('Room startup failed; operator recovery required');})
   .finally(()=>{if(this.#pending.get(id)===task)this.#pending.delete(id);});
  this.#pending.set(id,task);return task;
 }
 /** Explicit only: no timer/request automatically clears quarantine. */
 async recover(raw:string){
  const id=roomUUID(raw);if(this.#closed||this.#pending.has(id)||!this.#failed.has(id))throw new Error('Room not recoverable');
  // Keep the failed marker until recovery finishes, preventing activation races.
  await this.#registry.recover(id);if(this.#closed)return;
  this.#failed.delete(id);await this.activate(id);
 }
 /** Stop future ticks, then await startup I/O already accepted. */
 async close(){this.#closed=true;this.#driver.close();await Promise.allSettled([...this.#pending.values()]);this.#active.clear();}
}

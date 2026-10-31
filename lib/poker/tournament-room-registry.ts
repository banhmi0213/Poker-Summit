import {createSupabaseRegistrationManagerHandler} from './registration-manager-handler';
import {createSupabasePokerLobbyHandler} from './lobby-request-handler';
/** One registry per trusted server process. No cross-process lease/election or listening server. */
import {DurableRoomOwner} from './durable-room-owner';
import {restoreRoom,type KeyRing,type RoomStore} from './room-persistence';
import {roomUUID,roomConfig,roomBinding,ROOM_CAPACITIES,type RoomCapacity,type RoomDirectory,type RoomAccess} from './room-directory';
import {FIELD_MAX_PLAYERS} from './tournament-field';
import {createSupabasePokerPlayerHandler} from './player-request-handler';
type Options={directory:RoomDirectory;store:RoomStore;keys:KeyRing;now?:()=>number;turnMs?:number;handPauseMs?:number;maxRooms?:number;onRoomBound?:(roomId:string)=>Promise<void>};
export class TournamentRoomRegistry {
 #owners=new Map<string,Promise<DurableRoomOwner|null>>();#finalizing=new Map<string,{count:number;task:Promise<import('./registration-management').RegistrationManagementStatus>}>();#options:Options;#limit:number;
 constructor(options:Options){const limit=options.maxRooms??128;if(!Number.isSafeInteger(limit)||limit<1||limit>10000)throw new Error('Invalid room registry limit');this.#options={...options,keys:structuredClone(options.keys)};this.#limit=limit;}
 /** Admission is NEVER cached. Caller identity must already be Auth-verified. */
 authorize(access:RoomAccess){return this.#options.directory.authorize(structuredClone(access));}
 #reserve(roomId:string,operation:()=>Promise<DurableRoomOwner|null>){
  if(this.#owners.size>=this.#limit)return Promise.reject(new Error('Room registry is full'));
  // Store promise before I/O; concurrent lookups/provision cannot create duplicate owners.
  const pending=Promise.resolve().then(operation);this.#owners.set(roomId,pending);
  void pending.then(owner=>{if(!owner&&this.#owners.get(roomId)===pending)this.#owners.delete(roomId);},()=>{if(this.#owners.get(roomId)===pending)this.#owners.delete(roomId);});return pending;
 }
 owner(id:string):Promise<DurableRoomOwner|null>{
  const roomId=roomUUID(id),existing=this.#owners.get(roomId);if(existing)return existing;
  return this.#reserve(roomId,async()=>{const raw=await this.#options.directory.binding(roomId);if(!raw)return null;const binding=roomBinding(raw);if(binding.roomId!==roomId||!binding.enabled)return null;
   return DurableRoomOwner.load({...this.#options,roomId,expectedConfig:binding});});
 }
 /** Trusted pre-start assignment only, NOT a client request or tournament registration UI.
  * Persist empty room first; bind immutable roster only if its config still matches published DB.
  * Failures never expose the new owner. Do not delete on uncertain outcome; inspect/reload binding.
  */
 provision(id:string,tournamentId:string,members:readonly string[],policy:{capacity:RoomCapacity;allowSpectators:boolean}){
  const roomId=roomUUID(id),tournament=roomUUID(tournamentId),ids=members.map(roomUUID),copied={capacity:policy.capacity,allowSpectators:policy.allowSpectators};
  if(!ROOM_CAPACITIES.includes(copied.capacity)||typeof copied.allowSpectators!=='boolean'||ids.length<2||ids.length>copied.capacity||new Set(ids).size!==ids.length)throw new Error('Invalid provision request');
  if(this.#owners.has(roomId))throw new Error('Room already managed');
  return this.#reserve(roomId,async()=>{const raw=await this.#options.directory.tournament(tournament);if(!raw)throw new Error('Published tournament not found');const config=roomConfig(raw);if(config.tournamentId!==tournament)throw new Error('Tournament identity mismatch');
   const owner=await DurableRoomOwner.create(config,{...this.#options,roomId,expectedConfig:config});
   await this.#options.directory.provision({...config,roomId,...copied,enabled:true},ids);return owner;});
 }
 /** Roster handoff (one table for 2–6, a multi-table field for 7–100). Freeze once, retain the SAME plan/room on every retry. */
 finalizeRegistration(id:string,expectedCount:number,beforeBind:()=>Promise<void>=async()=>{}){
  const tid=roomUUID(id),pending=this.#finalizing.get(tid);if(pending){if(pending.count!==expectedCount)return Promise.reject(new Error('Roster count changed'));return pending.task;}if(!Number.isSafeInteger(expectedCount)||expectedCount<2||expectedCount>FIELD_MAX_PLAYERS)return Promise.reject(new Error('Require 2-60 players'));if(this.#finalizing.size>=this.#limit)return Promise.reject(new Error('Finalization capacity reached'));
  const task=Promise.resolve().then(async()=>{
   const plan=await this.#options.directory.freezeRegistration(tid,expectedCount),roomId=plan.roomId;
   const binding=await this.#options.directory.binding(roomId);
   if(binding){
    const control=await this.#options.directory.control(roomId);
    if(!binding.enabled||binding.capacity!==plan.capacity||binding.allowSpectators||JSON.stringify(roomConfig(binding))!==JSON.stringify(roomConfig(plan))||!control||!control.enabled||control.expectedCount!==plan.members.length||control.members.some(m=>!plan.members.includes(m)))throw new Error('Finalization binding mismatch');
    await this.owner(roomId);
   }else{
    if(this.#owners.has(roomId))throw new Error('Room operation in progress');
    await this.#reserve(roomId,async()=>{
     const saved=await restoreRoom(this.#options.store,roomId,this.#options.keys,{now:this.#options.now});let created:DurableRoomOwner|undefined;
     if(saved){const c=saved.room.checkpoint();if(saved.version!==1||c.room.seats.length||c.room.hand||c.room.revision!==0||c.room.handNumber!==0||JSON.stringify(roomConfig({tournamentId:tid,starts_at:c.startsAt,structure:c.structure}))!==JSON.stringify(roomConfig(plan)))throw new Error('Unbound checkpoint requires reconciliation');}
     else created=await DurableRoomOwner.create(plan,{...this.#options,roomId,expectedConfig:plan});
     await beforeBind();await this.#options.directory.provision(plan,plan.members);
     return created??DurableRoomOwner.load({...this.#options,roomId,expectedConfig:plan});
    });
   }
   const status=await this.#options.directory.managementStatus(tid);
   if(!status.finalization?.assigned||status.finalization.roomId!==roomId)throw new Error('Binding not confirmed');
   await this.#options.onRoomBound?.(roomId);return status;
  });this.#finalizing.set(tid,{count:expectedCount,task});void task.finally(()=>{if(this.#finalizing.get(tid)?.task===task)this.#finalizing.delete(tid);}).catch(()=>{});return task;
 }
 /** Trusted scheduled discovery. Frozen target pools are reused on retry. */
 async prepareEntries(){const pending=await this.#options.directory.pendingEntries?.()??[];const results=[];for(const entry of pending){try{await this.finalizeRegistration(entry.tournamentId,entry.count);results.push(true);}catch{results.push(false);}}return results;}
 /** Shutdown barrier; transport and timers must stop accepting work first. */
 async drain(){await Promise.allSettled([...this.#finalizing.values()].map(p=>p.task));const owners=await Promise.allSettled([...this.#owners.values()]);await Promise.all(owners.map(p=>p.status==='fulfilled'?p.value?.drain():undefined));}
 /** Fresh backend control for every timer decision; missing/disabled rooms do not auto-start. */
 async advance(id:string){
  const roomId=roomUUID(id),control=await this.#options.directory.control(roomId);
  if(!control||control.roomId!==roomId)return null;
  if(!control.enabled)return null;
  const owner=await this.owner(roomId);if(!owner)return null;return owner.advance(control);
 }
 /** Explicit operator recovery; halted owners are never silently replaced per player request. */
 async recover(id:string){const owner=await this.owner(id);if(!owner)throw new Error('Managed room not found');return owner.recover();}
 managerHandler(options:Omit<Parameters<typeof createSupabaseRegistrationManagerHandler>[0],'status'|'configure'|'finalize'>){return createSupabaseRegistrationManagerHandler({...options,status:id=>this.#options.directory.managementStatus(id),configure:(id,capacity,enabled)=>this.#options.directory.configureRegistration(id,capacity,enabled),finalize:(id,count,guard)=>this.finalizeRegistration(id,count,guard)});}
 lobbyHandler(options:Omit<Parameters<typeof createSupabasePokerLobbyHandler>[0],'assignments'|'registrations'>){return createSupabasePokerLobbyHandler({...options,assignments:member=>this.#options.directory.assignments(member),registrations:{catalog:member=>this.#options.directory.registrationCatalog(member),change:(member,tournament,action)=>this.#options.directory.changeRegistration(member,tournament,action)}});}
 playerHandler(options:Omit<Parameters<typeof createSupabasePokerPlayerHandler>[0],'authorize'|'owner'>){return createSupabasePokerPlayerHandler({...options,authorize:a=>this.authorize(a),owner:id=>this.owner(id)});}
}

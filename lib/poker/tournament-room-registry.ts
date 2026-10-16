/** One registry per trusted server process. No cross-process lease/election or listening server. */
import {DurableRoomOwner} from './durable-room-owner';
import type {KeyRing,RoomStore} from './room-persistence';
import {roomUUID,roomConfig,roomBinding,type RoomDirectory,type RoomAccess} from './room-directory';
import {createSupabasePokerPlayerHandler} from './player-request-handler';
type Options={directory:RoomDirectory;store:RoomStore;keys:KeyRing;now?:()=>number;turnMs?:number;maxRooms?:number};
export class TournamentRoomRegistry {
 #owners=new Map<string,Promise<DurableRoomOwner|null>>();#options:Options;#limit:number;
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
 provision(id:string,tournamentId:string,members:readonly string[],policy:{capacity:2|6;allowSpectators:boolean}){
  const roomId=roomUUID(id),tournament=roomUUID(tournamentId),ids=members.map(roomUUID),copied={capacity:policy.capacity,allowSpectators:policy.allowSpectators};
  if(![2,6].includes(copied.capacity)||typeof copied.allowSpectators!=='boolean'||ids.length<2||ids.length>copied.capacity||new Set(ids).size!==ids.length)throw new Error('Invalid provision request');
  if(this.#owners.has(roomId))throw new Error('Room already managed');
  return this.#reserve(roomId,async()=>{const raw=await this.#options.directory.tournament(tournament);if(!raw)throw new Error('Published tournament not found');const config=roomConfig(raw);if(config.tournamentId!==tournament)throw new Error('Tournament identity mismatch');
   const owner=await DurableRoomOwner.create(config,{...this.#options,roomId,expectedConfig:config});
   await this.#options.directory.provision({...config,roomId,...copied,enabled:true},ids);return owner;});
 }
 /** Explicit operator recovery; halted owners are never silently replaced per player request. */
 async recover(id:string){const owner=await this.owner(id);if(!owner)throw new Error('Managed room not found');return owner.recover();}
 playerHandler(options:Omit<Parameters<typeof createSupabasePokerPlayerHandler>[0],'authorize'|'owner'>){return createSupabasePokerPlayerHandler({...options,authorize:a=>this.authorize(a),owner:id=>this.owner(id)});}
}

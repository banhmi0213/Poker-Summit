import {managementStatus,type RegistrationManagementStatus} from './registration-management';
import {registrationCatalog,registrationOutcome,type RegistrationSummary,type RegistrationOutcome} from './registration';
/** Backend-only directory/admission adapter. Never instantiate with a user-session client. */
import type {TournamentControl} from './scheduled-tournament-room';
import {pokerUUID} from './request-auth';
import {validateStructure,type TournamentStructure} from './tournament';
import {FIELD_MAX_PLAYERS} from './tournament-field';
/** 2 (heads-up), 6 (one table) or 400 (multi-table field, 7+ players; 2026/11/02). 60, 100 and 200 were the field sizes before; kept valid for rooms made then. */
export type RoomCapacity=2|6|60|100|200|400;
export const ROOM_CAPACITIES:readonly number[]=[2,6,60,100,200,FIELD_MAX_PLAYERS];
export function capacityFor(players:number):RoomCapacity{return players===2?2:players<=6?6:400;}
export type PlayerOperation='seat'|'connect'|'state'|'spectate'|'act'|'disconnect'|'leave';
export type RoomAccess={memberId:string;roomId:string;operation:PlayerOperation};
export type RoomConfig={tournamentId:string;starts_at:string;structure:TournamentStructure};
export type RoomBinding=RoomConfig&{roomId:string;capacity:RoomCapacity;allowSpectators:boolean;enabled:boolean};
export type RoomControl=TournamentControl&{roomId:string};
export type RoomAssignment={roomId:string;tournamentId:string;title:string;starts_at:string;capacity:RoomCapacity;published:boolean};
export function roomAssignments(data:unknown):RoomAssignment[]{
 if(!Array.isArray(data)||data.length>64)throw new Error('Invalid room assignments');
 const rooms=new Set<string>(),tournaments=new Set<string>();
 return data.map(row=>{const roomId=roomUUID(row?.roomId),tournamentId=roomUUID(row?.tournamentId),start=Date.parse(row.starts_at);
  if(rooms.has(roomId)||tournaments.has(tournamentId)||typeof row.title!=='string'||!row.title.trim()||[...row.title].length>200||typeof row.starts_at!=='string'||!Number.isSafeInteger(start)||start<0||!ROOM_CAPACITIES.includes(row.capacity)||typeof row.published!=='boolean')throw new Error('Invalid room assignments');rooms.add(roomId);tournaments.add(tournamentId);
  return {roomId,tournamentId,title:row.title,starts_at:new Date(start).toISOString(),capacity:row.capacity,published:row.published};
 });
}
export type RegistrationPlan=RoomBinding&{members:string[]};
export function registrationPlan(value:unknown,tournamentId:string):RegistrationPlan{const raw=value as RegistrationPlan,binding=roomBinding({...raw,enabled:true});if(binding.tournamentId!==roomUUID(tournamentId)||binding.allowSpectators||!Array.isArray(raw.members)||raw.members.length<2||raw.members.length>FIELD_MAX_PLAYERS||binding.capacity!==capacityFor(raw.members.length))throw Error('Invalid registration plan');const members=raw.members.map(roomUUID);if(new Set(members).size!==members.length)throw Error('Duplicate frozen member');return {...binding,members};}
export interface RoomDirectory {
 pendingEntries?():Promise<{tournamentId:string;count:number}[]>;
 startupRooms(limit:number):Promise<string[]>;
 managementStatus(tournament:string):Promise<RegistrationManagementStatus>;
 configureRegistration(tournament:string,capacity:number,enabled:boolean):Promise<RegistrationManagementStatus>;
 freezeRegistration(tournament:string,expectedCount:number):Promise<RegistrationPlan>;
 registrationCatalog(member:string):Promise<RegistrationSummary[]>;
 changeRegistration(member:string,tournament:string,action:'register'|'cancel'):Promise<RegistrationOutcome>;
 assignments(member:string):Promise<RoomAssignment[]>;
 control(id:string):Promise<RoomControl|null>;
 tournament(id:string):Promise<RoomConfig|null>;
 binding(id:string):Promise<RoomBinding|null>;
 authorize(access:RoomAccess):Promise<boolean>;
 provision(binding:RoomBinding,members:readonly string[]):Promise<void>;
}
export function roomUUID(value:string){if(typeof value!=='string'||!pokerUUID.test(value))throw new Error('Invalid room/member identity');return value.toLowerCase();}
export function roomConfig(value:RoomConfig):RoomConfig {
 const tournamentId=roomUUID(value?.tournamentId),start=Date.parse(value.starts_at);
 if(typeof value.starts_at!=='string'||!Number.isSafeInteger(start)||start<0)throw new Error('Invalid stored room schedule');
 const s=validateStructure(value.structure);
 return {tournamentId,starts_at:new Date(start).toISOString(),structure:{startingStack:s.startingStack,anteType:s.anteType,lateRegLevel:s.lateRegLevel,reentry:s.reentry,
  periods:s.periods.map(p=>({kind:p.kind,minutes:p.minutes,sb:p.sb,bb:p.bb,ante:p.ante,note:p.note})),
  // Turn time and time bank cards travel with the structure (2026/10/30: they were dropped here, so a tournament
  // using them could not bind its room — the frozen structure in the database no longer matched).
  ...(s.turnSeconds!==undefined?{turnSeconds:s.turnSeconds}:{}),...(s.timeBankCards!==undefined?{timeBankCards:s.timeBankCards}:{}),...(s.finalTableCards!==undefined?{finalTableCards:s.finalTableCards}:{})}};
}
export function roomBinding(value:RoomBinding):RoomBinding {
 const c=roomConfig(value);
 if(!ROOM_CAPACITIES.includes(value.capacity)||typeof value.allowSpectators!=='boolean'||typeof value.enabled!=='boolean')throw new Error('Invalid stored room policy');
 return {...c,roomId:roomUUID(value.roomId),capacity:value.capacity,allowSpectators:value.allowSpectators,enabled:value.enabled};
}
type RpcClient={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
/** A failed read has not changed a hand or checkpoint. Never use for save failures. */
export class RoomControlUnavailable extends Error {constructor(){super('Room control read unavailable');}}
export class SupabaseRoomDirectory implements RoomDirectory {
 constructor(private client:RpcClient){}
 async #rpc(name:string,args:Record<string,unknown>){const {data,error}=await this.client.rpc(name,args);if(error)throw new Error('Room directory unavailable');return data;}
 async pendingEntries(){const data=await this.#rpc('poker_entry_due',{});if(!Array.isArray(data)||data.length>128)throw Error('Invalid entry discovery');const seen=new Set();return data.map(row=>{const tournamentId=roomUUID(row?.tournamentId);if(seen.has(tournamentId)||!Number.isSafeInteger(row.count)||row.count<2||row.count>FIELD_MAX_PLAYERS)throw Error('Invalid entry target count');seen.add(tournamentId);return {tournamentId,count:row.count};});}
 async startupRooms(limit:number){
  if(!Number.isSafeInteger(limit)||limit<1||limit>10000)throw Error('Invalid startup limit');
  const data=await this.#rpc('poker_room_startup_ids',{p_limit:limit});
  if(!Array.isArray(data)||data.length>limit)throw Error('Startup discovery unavailable or capacity exceeded');
  const ids=data.map(roomUUID);if(new Set(ids).size!==ids.length)throw Error('Duplicate startup room');return ids;
 }
 async managementStatus(tournament:string){const id=roomUUID(tournament);return managementStatus(await this.#rpc('poker_registration_management_status',{p_tournament:id}),id);}
 async configureRegistration(tournament:string,capacity:number,enabled:boolean){const id=roomUUID(tournament);if(!Number.isSafeInteger(capacity)||capacity<2||capacity>FIELD_MAX_PLAYERS||typeof enabled!=='boolean')throw Error('Invalid registration policy');await this.#rpc('poker_registration_configure',{p_tournament:id,p_capacity:capacity,p_enabled:enabled});return this.managementStatus(id);}
 async freezeRegistration(tournament:string,expectedCount:number){const id=roomUUID(tournament);if(!Number.isSafeInteger(expectedCount)||expectedCount<2||expectedCount>FIELD_MAX_PLAYERS)throw Error('Invalid expected roster');const plan=registrationPlan(await this.#rpc('poker_registration_freeze',{p_tournament:id,p_expected:expectedCount}),id);if(plan.members.length!==expectedCount)throw Error('Frozen roster count mismatch');return plan;}
 async registrationCatalog(member:string){return registrationCatalog(await this.#rpc('poker_registration_catalog',{p_member:roomUUID(member)}));}
 async changeRegistration(member:string,tournament:string,action:'register'|'cancel'){const id=roomUUID(tournament);if(!['register','cancel'].includes(action))throw Error('Invalid registration action');return registrationOutcome(await this.#rpc('poker_registration_change',{p_member:roomUUID(member),p_tournament:id,p_action:action}),id);}
 async assignments(member:string){return roomAssignments(await this.#rpc('poker_room_assignments',{p_member:roomUUID(member)}));}
 async tournament(id:string){id=roomUUID(id);const data=await this.#rpc('poker_room_tournament_config',{p_tournament:id});if(data===null)return null;const c=roomConfig(data as RoomConfig);if(c.tournamentId!==id)throw new Error('Tournament binding mismatch');return c;}
 async binding(id:string){id=roomUUID(id);const data=await this.#rpc('poker_room_binding',{p_room:id});if(data===null)return null;const b=roomBinding(data as RoomBinding);if(b.roomId!==id)throw new Error('Room binding mismatch');return b;}
 async control(id:string):Promise<RoomControl|null>{
  id=roomUUID(id);let data:unknown;try{data=await this.#rpc('poker_room_control',{p_room:id});}catch{throw new RoomControlUnavailable();}if(data===null)return null;const c=data as RoomControl;
  if(roomUUID(c.roomId)!==id||typeof c.enabled!=='boolean'||typeof c.published!=='boolean'||!Number.isSafeInteger(c.expectedCount)||c.expectedCount<2||c.expectedCount>FIELD_MAX_PLAYERS||!Array.isArray(c.members)||c.members.length>c.expectedCount)throw new Error('Invalid room control');
  const members=c.members.map(roomUUID);if(new Set(members).size!==members.length)throw new Error('Invalid room roster');
  return {roomId:id,enabled:c.enabled,published:c.published,expectedCount:c.expectedCount,members,...(c.seatedStart===true?{seatedStart:true}:{})};
 }
 async authorize(access:RoomAccess){
  const roomId=roomUUID(access.roomId),memberId=roomUUID(access.memberId);
  if(!['seat','connect','state','spectate','act','disconnect','leave'].includes(access.operation))return false;
  const data=await this.#rpc('poker_room_authorize',{p_room:roomId,p_member:memberId,p_operation:access.operation});
  if(typeof data!=='boolean')throw new Error('Invalid admission response');return data;
 }
 async provision(input:RoomBinding,members:readonly string[]){const b=roomBinding(input),ids=members.map(roomUUID);
  if(!b.enabled||ids.length<2||ids.length>b.capacity||new Set(ids).size!==ids.length)throw new Error('Invalid admission roster');
  const data=await this.#rpc('poker_room_provision',{p_room:b.roomId,p_tournament:b.tournamentId,p_members:ids,p_capacity:b.capacity,p_spectators:b.allowSpectators,p_starts:b.starts_at,p_structure:b.structure});
  if(data!==true)throw new Error('Room provision failed');
 }
}

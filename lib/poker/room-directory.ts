import {registrationCatalog,registrationOutcome,type RegistrationSummary,type RegistrationOutcome} from './registration';
/** Backend-only directory/admission adapter. Never instantiate with a user-session client. */
import type {TournamentControl} from './scheduled-tournament-room';
import {pokerUUID} from './request-auth';
import {validateStructure,type TournamentStructure} from './tournament';
export type PlayerOperation='seat'|'connect'|'state'|'spectate'|'act'|'disconnect'|'leave';
export type RoomAccess={memberId:string;roomId:string;operation:PlayerOperation};
export type RoomConfig={tournamentId:string;starts_at:string;structure:TournamentStructure};
export type RoomBinding=RoomConfig&{roomId:string;capacity:2|6;allowSpectators:boolean;enabled:boolean};
export type RoomControl=TournamentControl&{roomId:string};
export type RoomAssignment={roomId:string;tournamentId:string;title:string;starts_at:string;capacity:2|6;published:boolean};
export function roomAssignments(data:unknown):RoomAssignment[]{
 if(!Array.isArray(data)||data.length>64)throw new Error('Invalid room assignments');
 const rooms=new Set<string>(),tournaments=new Set<string>();
 return data.map(row=>{const roomId=roomUUID(row?.roomId),tournamentId=roomUUID(row?.tournamentId),start=Date.parse(row.starts_at);
  if(rooms.has(roomId)||tournaments.has(tournamentId)||typeof row.title!=='string'||!row.title.trim()||[...row.title].length>200||typeof row.starts_at!=='string'||!Number.isSafeInteger(start)||start<0||![2,6].includes(row.capacity)||typeof row.published!=='boolean')throw new Error('Invalid room assignments');rooms.add(roomId);tournaments.add(tournamentId);
  return {roomId,tournamentId,title:row.title,starts_at:new Date(start).toISOString(),capacity:row.capacity,published:row.published};
 });
}
export interface RoomDirectory {
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
  periods:s.periods.map(p=>({kind:p.kind,minutes:p.minutes,sb:p.sb,bb:p.bb,ante:p.ante,note:p.note}))}};
}
export function roomBinding(value:RoomBinding):RoomBinding {
 const c=roomConfig(value);
 if(![2,6].includes(value.capacity)||typeof value.allowSpectators!=='boolean'||typeof value.enabled!=='boolean')throw new Error('Invalid stored room policy');
 return {...c,roomId:roomUUID(value.roomId),capacity:value.capacity,allowSpectators:value.allowSpectators,enabled:value.enabled};
}
type RpcClient={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
export class SupabaseRoomDirectory implements RoomDirectory {
 constructor(private client:RpcClient){}
 async #rpc(name:string,args:Record<string,unknown>){const {data,error}=await this.client.rpc(name,args);if(error)throw new Error('Room directory unavailable');return data;}
 async registrationCatalog(member:string){return registrationCatalog(await this.#rpc('poker_registration_catalog',{p_member:roomUUID(member)}));}
 async changeRegistration(member:string,tournament:string,action:'register'|'cancel'){const id=roomUUID(tournament);if(!['register','cancel'].includes(action))throw Error('Invalid registration action');return registrationOutcome(await this.#rpc('poker_registration_change',{p_member:roomUUID(member),p_tournament:id,p_action:action}),id);}
 async assignments(member:string){return roomAssignments(await this.#rpc('poker_room_assignments',{p_member:roomUUID(member)}));}
 async tournament(id:string){id=roomUUID(id);const data=await this.#rpc('poker_room_tournament_config',{p_tournament:id});if(data===null)return null;const c=roomConfig(data as RoomConfig);if(c.tournamentId!==id)throw new Error('Tournament binding mismatch');return c;}
 async binding(id:string){id=roomUUID(id);const data=await this.#rpc('poker_room_binding',{p_room:id});if(data===null)return null;const b=roomBinding(data as RoomBinding);if(b.roomId!==id)throw new Error('Room binding mismatch');return b;}
 async control(id:string):Promise<RoomControl|null>{
  id=roomUUID(id);const data=await this.#rpc('poker_room_control',{p_room:id});if(data===null)return null;const c=data as RoomControl;
  if(roomUUID(c.roomId)!==id||typeof c.enabled!=='boolean'||typeof c.published!=='boolean'||!Number.isSafeInteger(c.expectedCount)||c.expectedCount<2||c.expectedCount>6||!Array.isArray(c.members)||c.members.length>c.expectedCount)throw new Error('Invalid room control');
  const members=c.members.map(roomUUID);if(new Set(members).size!==members.length)throw new Error('Invalid room roster');
  return {roomId:id,enabled:c.enabled,published:c.published,expectedCount:c.expectedCount,members};
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

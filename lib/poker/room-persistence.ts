/** Node/server only. Keys and decrypted checkpoints must never enter client bundles/logs. */
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {ScheduledTournamentRoom,type ScheduledCheckpoint} from './scheduled-tournament-room';
export type SealedCheckpoint={format:1;keyId:string;iv:string;tag:string;data:string};
export type KeyRing={active:string;keys:Readonly<Record<string,Uint8Array>>};
export type SavedRoom={version:number;sealed:SealedCheckpoint};
export type SaveRequest={roomId:string;expectedVersion:number;writeId:string;sealed:SealedCheckpoint;result:ReturnType<typeof terminalResult>};
export interface RoomStore {load(roomId:string):Promise<SavedRoom|null>;save(request:SaveRequest):Promise<number>}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxBytes=2*1024*1024;
function identity(roomId:string,version:number) {if(!uuid.test(roomId)||!Number.isSafeInteger(version)||version<1)throw new Error('Invalid checkpoint identity');return Buffer.from(JSON.stringify(['poker-room',1,roomId.toLowerCase(),version]));}
function key(ring:KeyRing,id:string) {const k=Object.hasOwn(ring.keys,id)?ring.keys[id]:null;if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!k||k.byteLength!==32)throw new Error('Unavailable checkpoint key');return k;}
export function sealCheckpoint(roomId:string,version:number,state:ScheduledCheckpoint,ring:KeyRing):SealedCheckpoint {
 const aad=identity(roomId,version),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(ring,ring.active),iv),plain=Buffer.from(JSON.stringify(state));
 if(plain.length>maxBytes)throw new Error('Checkpoint too large');
 cipher.setAAD(aad);const data=Buffer.concat([cipher.update(plain),cipher.final()]);
 return {format:1,keyId:ring.active,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}
export function openCheckpoint(roomId:string,version:number,sealed:SealedCheckpoint,ring:KeyRing):ScheduledCheckpoint {
 const aad=identity(roomId,version);
 if(sealed?.format!==1||typeof sealed.data!=='string'||sealed.data.length>Math.ceil(maxBytes/3)*4||typeof sealed.iv!=='string'||typeof sealed.tag!=='string')throw new Error('Invalid sealed checkpoint');
 const iv=Buffer.from(sealed.iv,'base64'),tag=Buffer.from(sealed.tag,'base64');
 if(iv.length!==12||tag.length!==16)throw new Error('Invalid sealed checkpoint');
 const decipher=createDecipheriv('aes-256-gcm',key(ring,sealed.keyId),iv);decipher.setAAD(aad);decipher.setAuthTag(tag);
 const value=JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.data,'base64')),decipher.final()]).toString('utf8'));
 if(value?.version!==1)throw new Error('Unsupported room checkpoint');return value;
}
function terminalResult(room:ScheduledTournamentRoom) {
 const s=room.publicSnapshot(),h=s.hand;
 return h?.result?{handId:h.handId,handNumber:s.handNumber,...h.result,tournament:s.tournament,participants:room.checkpoint().room.seats.map(([seat,p])=>({seatId:`seat-${seat}`,memberId:p.memberId}))}:null;
}
/** Prepare once; retry this EXACT request on ambiguous network failure (fresh encryption differs).
 * Do not acknowledge/broadcast a mutation until commit resolves. On conflict/failure stop the
 * owner and reload/reconnect; this primitive does not roll back live memory or run a scheduler.
 */
export function prepareRoomSave(roomId:string,expectedVersion:number,room:ScheduledTournamentRoom,ring:KeyRing,writeId=randomUUID()) {
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!uuid.test(writeId))throw new Error('Invalid save identity');
 const result=terminalResult(room),sealed=sealCheckpoint(roomId,expectedVersion+1,room.checkpoint(),ring);
 const request:SaveRequest={roomId,expectedVersion,writeId,sealed,result};
 // Detached immutable-by-ownership request: callers can retry but cannot change the commit payload.
 return {request:structuredClone(request),commit:(store:RoomStore)=>store.save(structuredClone(request))};
}
export async function restoreRoom(store:RoomStore,roomId:string,ring:KeyRing,options:{now?:()=>number}={}) {
 identity(roomId,1);const saved=await store.load(roomId);if(!saved)return null;
 return {version:saved.version,room:ScheduledTournamentRoom.restore(openCheckpoint(roomId,saved.version,saved.sealed,ring),options)};
}
/** Dedicated backend service-role client only; never reuse a browser/user-session client. */
type RpcClient={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
export class SupabaseRoomStore implements RoomStore {
 constructor(private client:RpcClient,private report:(event:{roomId:string;operation:'load'|'save';reason:string})=>void=()=>{}){}
 #failure(roomId:string,operation:'load'|'save',error:unknown){
  // Never emit PostgREST messages/details: they may contain SQL, keys or payloads.
  const code=typeof error==='object'&&error!==null&&'code' in error?error.code:null;
  const reason=['P0001','57014','40001','40P01','42501','23505','PGRST002'].includes(String(code))?String(code):'unclassified';
  try{this.report({roomId,operation,reason});}catch{}
 }
 async load(roomId:string):Promise<SavedRoom|null> {
  identity(roomId,1);const {data,error}=await this.client.rpc('poker_room_load',{p_room:roomId});if(error){this.#failure(roomId,'load',error);throw new Error('Room load failed');}
  if(data===null)return null;
  const s=data as SavedRoom;if(!Number.isSafeInteger(s?.version)||s.version<1||!s.sealed)throw new Error('Invalid stored room');return s;
 }
 async save(r:SaveRequest) {
  const {data,error}=await this.client.rpc('poker_room_save',{p_room:r.roomId,p_expected:r.expectedVersion,p_write:r.writeId,p_sealed:r.sealed,p_result:r.result});
  if(error){this.#failure(r.roomId,'save',error);throw new Error('Room save failed; reload owner before serving');}
  if(!Number.isSafeInteger(data)||Number(data)!==r.expectedVersion+1)throw new Error('Invalid save response');return Number(data);
 }
}

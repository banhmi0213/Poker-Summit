/** Deployable standard Request/Response adapter; no route or listening service is installed here. */
import type {DurableRoomOwner} from './durable-room-owner';
import {parseHandCommand} from './authoritative-hand';
import {PokerAuthError,pokerUUID,createSupabasePokerAuthenticator,type VerifiedPokerMember} from './request-auth';
import type {RoomAccess as Access} from './room-directory';
type Dependencies={origins:readonly string[];verify:(token:string)=>Promise<VerifiedPokerMember>;authorize:(access:Access)=>Promise<boolean>;owner:(roomId:string)=>Promise<DurableRoomOwner|null>};
class RequestError extends Error {constructor(readonly status:number){super('Invalid poker request');}}
const maxBytes=4096;
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new RequestError(400);return value as Record<string,unknown>;}
function exact(value:Record<string,unknown>,keys:string[]){if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new RequestError(400);}
function parse(value:unknown){
 const body=object(value),type=body.type;
 if(type==='seat'){exact(body,['type','seat']);if(!Number.isSafeInteger(body.seat)||Number(body.seat)<1||Number(body.seat)>6)throw new RequestError(400);return {type,seat:Number(body.seat)} as const;}
 if(type==='act'){exact(body,['type','command']);try{const command=parseHandCommand(body.command);if(command.actionId.startsWith('timeout_'))throw Error();return {type,command} as const;}catch{throw new RequestError(400);}}
 if(type==='connect'||type==='state'||type==='spectate'||type==='disconnect'||type==='leave'){exact(body,['type']);return {type} as const;}
 throw new RequestError(400);
}
async function readJSON(request:Request){
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new RequestError(Number(length)>maxBytes?413:400);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError(415);
 if(!request.body)throw new RequestError(400);
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){void reader.cancel().catch(()=>{});throw new RequestError(413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError(400);}
}
function response(status:number,value:unknown){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','Pragma':'no-cache','Vary':'Origin, Authorization, X-Poker-Connection','X-Content-Type-Options':'nosniff',...(status===405?{Allow:'POST'}:{})}});}
/** Mandatory server-owned room authorization is separate from authentication. No allow-all default.
 * Request body/URL never selects member/viewer identity or server scheduling/admin operations.
 */
export function createPokerPlayerHandler(dependencies:Dependencies){
 const origins=new Set(dependencies.origins);
 if(!origins.size||[...origins].some(o=>{try{const u=new URL(o);return !['https:','http:'].includes(u.protocol)||u.origin!==o;}catch{return true;}})||typeof dependencies.verify!=='function'||typeof dependencies.authorize!=='function'||typeof dependencies.owner!=='function')throw new Error('Invalid poker request configuration');
 return async(request:Request,roomId:string):Promise<Response>=>{
  try{
   if(request.method!=='POST')throw new RequestError(405);
   if(!origins.has(request.headers.get('origin')??''))throw new RequestError(403);
   if(!pokerUUID.test(roomId)||new URL(request.url).search)throw new RequestError(400);
   roomId=roomId.toLowerCase();
   const header=request.headers.get('authorization')??'',match=/^Bearer ([A-Za-z0-9._~-]+)$/i.exec(header);
   if(!match||match[1].length>8192)throw new RequestError(401);
   const body=parse(await readJSON(request)),needsConnection=['state','act','disconnect','leave'].includes(body.type),connection=request.headers.get('x-poker-connection');
   if(needsConnection?(!connection||!pokerUUID.test(connection)):connection!==null)throw new RequestError(400);
   const verified=await dependencies.verify(match[1]);
   if(!verified||!pokerUUID.test(verified.memberId))throw new RequestError(401);
   const memberId=verified.memberId.toLowerCase();
   if(await dependencies.authorize({memberId,roomId,operation:body.type})!==true)throw new RequestError(403);
   if(request.signal.aborted)throw new RequestError(400);
   const owner=await dependencies.owner(roomId);if(!owner)throw new RequestError(404);
   try{
    let result:unknown;
    switch(body.type){
     case 'seat':result=await owner.seat(memberId,body.seat);break;
     case 'connect':result=await owner.connect(memberId);break;
     case 'state':result=await owner.snapshot(memberId,connection!);break;
     case 'spectate':result=await owner.publicSnapshot();break;
     case 'act':result=await owner.act(memberId,connection!,body.command);break;
     case 'disconnect':result=await owner.disconnect(memberId,connection!);break;
     case 'leave':result=await owner.leave(memberId,connection!);break;
    }
    return response(200,{ok:true,result});
   }catch(error){
    if(owner.health.status==='halted'||error instanceof Error&&error.message==='Room queue is full')throw new RequestError(503);
    // Stale versions/tokens, wrong turn, locked seating etc. Never return internal error text.
    throw new RequestError(409);
   }
  }catch(error){const status=error instanceof RequestError||error instanceof PokerAuthError?error.status:503;return response(status,{ok:false,error:status===401?'authentication_required':status===403?'forbidden':status===404?'room_not_found':status===409?'refresh_required':status===413?'request_too_large':status===415?'json_required':status===405?'post_required':status===503?'temporarily_unavailable':'invalid_request'});}
 };
}

/** Composition for a future trusted server route/worker; still requires explicit room admission. */
export function createSupabasePokerPlayerHandler(options:Omit<Dependencies,'verify'>&{auth:Parameters<typeof createSupabasePokerAuthenticator>[0]}) {
 const {auth,...dependencies}=options;return createPokerPlayerHandler({...dependencies,verify:createSupabasePokerAuthenticator(auth)});
}

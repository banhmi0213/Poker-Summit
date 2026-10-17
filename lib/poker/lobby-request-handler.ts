/** Backend lobby lookup. Identity is verified bearer context, never a body/query parameter. */
import {PokerAuthError,pokerUUID,createSupabasePokerAuthenticator,type VerifiedPokerMember} from './request-auth';
import {readPokerJSON} from './player-request-handler';
import {roomAssignments,type RoomAssignment} from './room-directory';
type Options={origins:readonly string[];verify:(token:string)=>Promise<VerifiedPokerMember>;assignments:(memberId:string)=>Promise<RoomAssignment[]>};
export function createPokerLobbyHandler(options:Options){
 const origins=new Set(options.origins);if(!origins.size||[...origins].some(o=>{try{return new URL(o).origin!==o||!/^https?:/.test(o);}catch{return true;}}))throw Error('Invalid lobby origins');
 return async(request:Request)=>{
  const response=(status:number,value:unknown)=>Response.json(value,{status,headers:{'Cache-Control':'no-store, private','Pragma':'no-cache','Vary':'Origin, Authorization','X-Content-Type-Options':'nosniff'}});
  try{
   if(request.method!=='POST')return response(405,{ok:false,error:'post_required'});
   if(!origins.has(request.headers.get('origin')??''))return response(403,{ok:false,error:'forbidden'});
   if(new URL(request.url).search||request.headers.has('x-poker-connection'))return response(400,{ok:false,error:'invalid_request'});
   const match=/^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization')??'');if(!match)return response(401,{ok:false,error:'authentication_required'});
   const body=await readPokerJSON(request);if(!body||Object.keys(body).join(',')!=='type'||body.type!=='assignments')return response(400,{ok:false,error:'invalid_request'});
   const member=await options.verify(match[1]);if(!pokerUUID.test(member?.memberId))return response(401,{ok:false,error:'authentication_required'});
   if(request.signal.aborted)return response(400,{ok:false,error:'invalid_request'});
   const assignments=roomAssignments(await options.assignments(member.memberId.toLowerCase()));
   if(request.signal.aborted)return response(400,{ok:false,error:'invalid_request'});
   return response(200,{ok:true,result:assignments});
  }catch(error){const status=error instanceof PokerAuthError?error.status:error instanceof Error&&'status' in error?Number(error.status):503;return response([400,401,403,413,415,503].includes(status)?status:503,{ok:false,error:'lobby_unavailable'});}
 };
}
export function createSupabasePokerLobbyHandler(options:Omit<Options,'verify'>&{auth:Parameters<typeof createSupabasePokerAuthenticator>[0]}){const {auth,...rest}=options;return createPokerLobbyHandler({...rest,verify:createSupabasePokerAuthenticator(auth)});}

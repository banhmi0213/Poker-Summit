/** Separate manager boundary. Verified identity AND current user-context event permission required. */
import {createClient} from '@supabase/supabase-js';
import {createSupabasePokerAuthenticator,PokerAuthError,pokerUUID,type VerifiedPokerMember} from './request-auth';
import {readPokerJSON} from './player-request-handler';
import {managementStatus,type RegistrationManagementStatus} from './registration-management';
type Options={origins:readonly string[];verify:(token:string)=>Promise<VerifiedPokerMember>;authorize:(token:string,tournament:string)=>Promise<boolean>;status:(id:string)=>Promise<RegistrationManagementStatus>;configure:(id:string,capacity:number,enabled:boolean)=>Promise<RegistrationManagementStatus>;finalize:(id:string,count:number,beforeBind:()=>Promise<void>)=>Promise<RegistrationManagementStatus>};
export function createRegistrationManagerHandler(options:Options){
 const origins=new Set(options.origins);if(!origins.size||[...origins].some(o=>{try{return new URL(o).origin!==o||!/^https?:/.test(o);}catch{return true;}}))throw Error('Invalid manager origins');
 return async(request:Request)=>{
  const respond=(status:number,result:unknown)=>Response.json(result,{status,headers:{'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Vary':'Origin, Authorization'}});
  try{
   if(request.method!=='POST')return respond(405,{ok:false,error:'post_required'});
   if(!origins.has(request.headers.get('origin')??''))throw new PokerAuthError(403);
   const bearer=/^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization')??'');if(!bearer)throw new PokerAuthError(401);
   if(new URL(request.url).search||request.headers.has('x-poker-connection'))return respond(400,{ok:false,error:'invalid_request'});
   const b=await readPokerJSON(request),keys=b&&typeof b==='object'?Object.keys(b).sort().join(','):'';
   if(!b||typeof b.tournamentId!=='string'||!pokerUUID.test(b.tournamentId)||!(keys==='tournamentId,type'&&b.type==='status'||keys==='expectedCount,tournamentId,type'&&b.type==='finalize'&&Number.isSafeInteger(b.expectedCount)&&b.expectedCount>=2&&b.expectedCount<=6||keys==='capacity,enabled,tournamentId,type'&&b.type==='configure'&&Number.isSafeInteger(b.capacity)&&b.capacity>=2&&b.capacity<=600&&typeof b.enabled==='boolean'))return respond(400,{ok:false,error:'invalid_request'});
   const tid=b.tournamentId.toLowerCase();let actor:string|null=null;
   const guard=async()=>{const member=await options.verify(bearer[1]);if(!pokerUUID.test(member?.memberId))throw new PokerAuthError(401);if(actor&&actor!==member.memberId.toLowerCase())throw new PokerAuthError(403);actor=member.memberId.toLowerCase();if(await options.authorize(bearer[1],tid)!==true)throw new PokerAuthError(403);if(request.signal.aborted)throw new PokerAuthError(503);};await guard();
   const result=b.type==='configure'?await options.configure(tid,b.capacity,b.enabled):b.type==='finalize'?await options.finalize(tid,b.expectedCount,guard):await options.status(tid);
   return respond(200,{ok:true,result:managementStatus(result,tid)});
  }catch(error){const status=error instanceof PokerAuthError?error.status:error instanceof Error&&'status' in error?Number(error.status):503;return respond([400,401,403,413,415,503].includes(status)?status:503,{ok:false,error:'management_unavailable'});}
 };
}
export function createSupabaseRegistrationManagerHandler(options:Omit<Options,'verify'|'authorize'>&{auth:Parameters<typeof createSupabasePokerAuthenticator>[0]}){
 const {auth,...rest}=options,verify=createSupabasePokerAuthenticator(auth);
 return createRegistrationManagerHandler({...rest,verify,authorize:async(token,tid)=>{
  const client=createClient(auth.url,auth.publicKey,{global:{headers:{Authorization:'Bearer '+token},...(auth.fetch?{fetch:auth.fetch}:{})},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.rpc('poker_registration_manage_allowed',{p_tournament:tid});if(error)throw new PokerAuthError(503);return data===true;
 }});
}

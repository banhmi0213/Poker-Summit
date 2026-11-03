import {tournamentActor} from '@/lib/poker/tournament-admin';
import {readPokerJSON} from '@/lib/poker/player-request-handler';
import {forwardRegistrationManagementRequest} from '@/lib/poker/room-service-proxy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const unavailable=(status:number)=>Response.json({ok:false,error:'management_unavailable'},{status,headers:{'Cache-Control':'no-store'}});
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin||new URL(request.url).search)return unavailable(403);
  if(!process.env.POKER_ROOM_SERVICE_ORIGIN)return unavailable(503);
  const body=await readPokerJSON(request);if(!body||!['admin','store'].includes(body.scope))return unavailable(400);
  const {scope,...command}=body,{client}=await tournamentActor(scope);
  const {data:{session}}=await client.auth.getSession();if(!session)return unavailable(401);
  const headers=new Headers({'content-type':'application/json',origin:request.headers.get('origin')!,authorization:'Bearer '+session.access_token});
  return forwardRegistrationManagementRequest(new Request(request.url,{method:'POST',headers,body:JSON.stringify(command),signal:request.signal}),process.env.POKER_ROOM_SERVICE_ORIGIN);
 }catch(error){const status=error instanceof Error&&'status' in error?Number(error.status):403;return unavailable([400,413,415].includes(status)?status:403);}
}

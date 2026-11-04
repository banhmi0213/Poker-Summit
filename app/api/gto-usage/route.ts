import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {classifyDevice,isBotUserAgent} from '@/lib/device';
import {getVisitorId} from '@/lib/visitor';
import {gtoUsageDatabaseReady} from '@/lib/gto-usage-environment';
import {isTool,isAction} from '@/lib/gto-usage';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:NextRequest){
 try{
  if(!gtoUsageDatabaseReady())return new NextResponse(null,{status:204});
  const ua=req.headers.get('user-agent');
  if(isBotUserAgent(ua)||req.cookies.get('ps_staff')?.value==='1')return new NextResponse(null,{status:204});
  const origin=req.headers.get('origin');
  if(origin&&origin!==req.nextUrl.origin)return new NextResponse(null,{status:204});
  const body=await req.json();
  if(!body||!isTool(body.tool)||!isAction(body.action)||!UUID.test(String(body.event_id??'')))return new NextResponse(null,{status:204});
  const visitor=getVisitorId();if(!visitor)return new NextResponse(null,{status:204});
  let member:string|null=null;
  if(req.cookies.getAll().some(c=>c.name.startsWith('sb-'))){
   const auth=await createClient();
   const {data:isAdmin,error}=await auth.rpc('is_admin');
   // Fail closed if exclusion cannot be verified; never count an admin after an auth failure.
   if(error||isAdmin===true)return new NextResponse(null,{status:204});
   const {data:{user},error:authError}=await auth.auth.getUser();
   if(authError)return new NextResponse(null,{status:204});
   if(user&&!user.is_anonymous)member=user.id;
  }
  await createServiceRoleClient().from('gto_usage_events').upsert({id:body.event_id,visitor_id:visitor,member_id:member,tool:body.tool,action:body.action,device:classifyDevice(ua)==='pc'?'pc':'mobile'},{onConflict:'id',ignoreDuplicates:true});
 }catch{/* No table / offline / denied: the customer's operation still succeeds. */}
 return new NextResponse(null,{status:204});
}

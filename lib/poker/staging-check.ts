/** Read-only staging preflight. Never run against the portal production project. */
import {readRoomServerConfig} from './room-server-config';
const productionRef='tjmeqnzvuoguoffltxrp';
export async function checkPokerStaging(env:Readonly<Record<string,string|undefined>>,network:typeof fetch=fetch){
 let config:ReturnType<typeof readRoomServerConfig>,app:string,service:string;
 try{
  config=readRoomServerConfig(env);
  const ref=env.POKER_STAGING_SUPABASE_REF;
  if(env.VERCEL_ENV!=='preview'||!ref||!/^[a-z0-9]{20}$/.test(ref)||ref===productionRef||config.url!==`https://${ref}.supabase.co`||env.NEXT_PUBLIC_SUPABASE_URL!==config.url||env.NEXT_PUBLIC_SUPABASE_ANON_KEY!==config.publicKey)throw Error();
  const https=(value:string|undefined)=>{const u=new URL(value??'');if(u.protocol!=='https:'||u.origin!==value||u.username||u.password)throw Error();return u.origin;};
  app=https(env.POKER_STAGING_APP_ORIGIN);service=https(env.POKER_ROOM_SERVICE_ORIGIN);
  const events=new URL(env.POKER_ROOM_EVENTS_ORIGIN??'');if(events.protocol!=='wss:'||events.origin!==env.POKER_ROOM_EVENTS_ORIGIN||events.host!==new URL(service).host||events.username||events.password||app===service||!config.origins.includes(app))throw Error();
 }catch{throw Error('staging_configuration_invalid');}
 const checks:string[]=[];
 const request=async(label:string,url:string,init:RequestInit,expected:number)=>{try{const r=await network(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.status!==expected)throw Error();return r;}catch{throw Error(label+'_failed');}};
 const settings=await request('supabase_auth',config.url+'/auth/v1/settings',{headers:{apikey:config.publicKey}},200);
 try{const value=await settings.json();if(!value||typeof value!=='object'||Array.isArray(value))throw Error();}catch{throw Error('supabase_auth_failed');}checks.push('supabase_auth_reachable');
 const discovery=await request('startup_rpc',config.url+'/rest/v1/rpc/poker_room_startup_ids',{method:'POST',headers:{apikey:config.secretKey,Authorization:'Bearer '+config.secretKey,'Content-Type':'application/json'},body:JSON.stringify({p_limit:config.maxRooms})},200);
 try{const ids:unknown=await discovery.json();if(!Array.isArray(ids)||ids.length>config.maxRooms||ids.some(x=>typeof x!=='string'||!/^[a-f0-9-]{36}$/i.test(x)))throw Error();}catch{throw Error('startup_rpc_failed');}checks.push('startup_rpc_reachable');
 for(const path of ['/healthz','/readyz']){const r=await request('backend_probe',service+path,{},200);try{if((await r.json()).ok!==true)throw Error();}catch{throw Error('backend_probe_failed');}}checks.push('backend_ready');
 const init={method:'POST',headers:{Origin:app,'Content-Type':'application/json'},body:'{"type":"assignments"}'};
 for(const origin of [service,app]){const r=await request('unauthenticated_boundary',origin+'/api/poker/lobby',init,401);try{if((await r.json()).ok!==false)throw Error();}catch{throw Error('unauthenticated_boundary_failed');}}checks.push('direct_and_next_gateway_require_auth');
 return {ok:true,checks,authenticatedGameVerified:false,webSocketVerified:false};
}

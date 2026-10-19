/** Server-only factory; no process/env/network side effects on import. */
import {createClient} from '@supabase/supabase-js';
import {SupabaseRoomDirectory} from './room-directory';
import {SupabaseRoomStore} from './room-persistence';
import {createPokerRoomService} from './room-service';
import {readRoomServerConfig} from './room-server-config';
export function createConfiguredPokerRoomService(env:Readonly<Record<string,string|undefined>>,network:typeof fetch=fetch){
 const config=readRoomServerConfig(env);
 // Bound backend and Auth calls. Preserve caller cancellation; never log requests.
 const boundedFetch:typeof fetch=(input,init)=>network(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(10000),...(init?.signal?[init.signal]:[]),...(input instanceof Request?[input.signal]:[])])});
 const backend=createClient(config.url,config.secretKey,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return createPokerRoomService({onDiagnostic:event=>console.log(JSON.stringify({type:'poker_room_diagnostic',...event})),registry:{directory:new SupabaseRoomDirectory(backend),store:new SupabaseRoomStore(backend,event=>console.log(JSON.stringify({type:'poker_storage_failure',...event}))),keys:config.keys,maxRooms:config.maxRooms},auth:{url:config.url,publicKey:config.publicKey,fetch:boundedFetch},origins:config.origins,host:config.host,port:config.port});
}
/** Explicit host integration only; caller owns exit status and hard-stop policy. */
export function registerPokerRoomShutdown(service:{close:()=>Promise<void>},host:{on:(event:string,callback:()=>void)=>unknown;off:(event:string,callback:()=>void)=>unknown},onClosed:(failed:boolean)=>void){
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;void service.close().then(()=>onClosed(false),()=>onClosed(true));};
 host.on('SIGTERM',stop);host.on('SIGINT',stop);
 return ()=>{host.off('SIGTERM',stop);host.off('SIGINT',stop);};
}

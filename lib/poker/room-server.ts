import {measureRing,type RingMetricSink} from './ring-metrics';
/** Server-only factory; no process/env/network side effects on import. */
import {createSupabaseRingLobbyHandler,SupabaseRingAdmissionStore} from './ring-lobby-handler';
import {RingPlayRuntime,SupabaseRingPlayStore,PlayingRingAdmissionStore} from './ring-play-runtime';
import {createClient} from '@supabase/supabase-js';
import {SupabaseRoomDirectory} from './room-directory';
import {SupabaseRoomStore} from './room-persistence';
import {createPokerRoomService} from './room-service';
import {readRoomServerConfig} from './room-server-config';
import {BotRunner} from './bot-runner';
import {attachRingEvents} from './ring-events';
import {createSupabasePokerAuthenticator} from './request-auth';
export function createConfiguredPokerRoomService(env:Readonly<Record<string,string|undefined>>,network:typeof fetch=fetch){
 const config=readRoomServerConfig(env);
 // Bound backend and Auth calls. Preserve caller cancellation; never log requests.
 const boundedFetch:typeof fetch=(input,init)=>network(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(10000),...(init?.signal?[init.signal]:[]),...(input instanceof Request?[input.signal]:[])])});
 const backend=createClient(config.url,config.secretKey,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const metric:RingMetricSink=event=>console.log(JSON.stringify(event));
 const ringBackend={rpc:(name:string,args:Record<string,unknown>)=>measureRing(metric,'rpc',name,()=>backend.rpc(name,args),result=>!result.error)};
 const ringRuntime=new RingPlayRuntime({store:()=>new SupabaseRingPlayStore(ringBackend),keys:config.keys,maxTables:Math.min(config.maxRooms,128),diagnostic:event=>console.log(JSON.stringify(event)),metric});
 const ringStore=new PlayingRingAdmissionStore(new SupabaseRingAdmissionStore(ringBackend),ringRuntime);
 // Ring tables push every committed change to the players' browsers (owner 2026/10/29: 相手の動きを早く映す).
 const ringEvents=(server:import('node:http').Server)=>{const verify=createSupabasePokerAuthenticator({url:config.url,publicKey:config.publicKey,fetch:boundedFetch});
  const hub=attachRingEvents(server,{origins:config.origins,verify,source:ringRuntime,playEnabled:(member,table)=>ringStore.playEnabled(member,table),extras:table=>ringStore.extras(table)});
  ringStore.onExtras=table=>hub.touch(table);return {close:async()=>{ringStore.onExtras=null;await hub.close();}};};
 const service=createPokerRoomService({ringRuntime,ringEvents,ringHandler:createSupabaseRingLobbyHandler({store:ringStore,metric,auth:{url:config.url,publicKey:config.publicKey,fetch:boundedFetch},origins:config.origins}),onDiagnostic:event=>console.log(JSON.stringify({type:'poker_room_diagnostic',...event})),registry:{directory:new SupabaseRoomDirectory(backend),store:new SupabaseRoomStore(backend,event=>console.log(JSON.stringify({type:'poker_storage_failure',...event}))),keys:config.keys,maxRooms:config.maxRooms},auth:{url:config.url,publicKey:config.publicKey,fetch:boundedFetch},origins:config.origins,host:config.host,port:config.port});
 // Staging CPU hands (off unless poker_private.bot_settings.enabled; never on production).
 const bots=new BotRunner({url:config.url,rpc:(name,args)=>backend.rpc(name,args),log:event=>console.log(JSON.stringify(event))});
 return {start:async()=>{const started=await service.start();void bots.start().catch(()=>console.log(JSON.stringify({type:'poker_bot_start_failed'})));return started;},
  close:async()=>{await bots.close().catch(()=>undefined);await service.close();},recover:service.recover,get health(){return service.health;}};
}
/** Explicit host integration only; caller owns exit status and hard-stop policy. */
export function registerPokerRoomShutdown(service:{close:()=>Promise<void>},host:{on:(event:string,callback:()=>void)=>unknown;off:(event:string,callback:()=>void)=>unknown},onClosed:(failed:boolean)=>void){
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;void service.close().then(()=>onClosed(false),()=>onClosed(true));};
 host.on('SIGTERM',stop);host.on('SIGINT',stop);
 return ()=>{host.off('SIGTERM',stop);host.off('SIGINT',stop);};
}

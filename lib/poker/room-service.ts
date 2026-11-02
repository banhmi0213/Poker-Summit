/** Explicit composition root for ONE authoritative server process.
 * No environment access, network listener or new room is created on import.
 */
import type {AddressInfo} from 'node:net';
import {TournamentRoomRegistry} from './tournament-room-registry';
import {RoomRuntime} from './room-runtime';
import {createPokerRoomHTTPServer} from './room-http-server';
import {attachPokerRoomWebSocket} from './room-websocket';
import type {createSupabasePokerAuthenticator} from './request-auth';
type Options={
 registry:Omit<ConstructorParameters<typeof TournamentRoomRegistry>[0],'onRoomBound'>;
 auth:Parameters<typeof createSupabasePokerAuthenticator>[0];
 origins:readonly string[];
 /** Trusted manifest from configuration/discovery; never client-supplied. */
 roomIds?:readonly string[];
 ringRuntime?:{start():Promise<void>;close():Promise<void>};
 ringHandler?:(request:Request)=>Promise<Response>;
 /** Ring table pushes on the same listener (ring-events.ts). */
 ringEvents?:(server:import('node:http').Server)=>{close():Promise<void>};
 onDiagnostic?:NonNullable<ConstructorParameters<typeof RoomRuntime>[1]>['onDiagnostic'];
 host?:string;port?:number;
};
export function createPokerRoomService(options:Options){
 const host=options.host??'127.0.0.1',port=options.port??0;
 if(typeof host!=='string'||!host||!Number.isSafeInteger(port)||port<0||port>65535)throw Error('Invalid listener configuration');
 const roomIds=options.roomIds===undefined?null:[...options.roomIds],origins=[...options.origins];let runtime:RoomRuntime;
 const registry=new TournamentRoomRegistry({...options.registry,onRoomBound:id=>runtime.activate(id)});
 runtime=new RoomRuntime(registry,{maxRooms:options.registry.maxRooms,onDiagnostic:options.onDiagnostic});
 const rawPlayer=registry.playerHandler({origins,auth:options.auth}),rawLobby=registry.lobbyHandler({origins,auth:options.auth}),rawManager=registry.managerHandler({origins,auth:options.auth});
 let closing=false,started=false,startTask:Promise<AddressInfo>|null=null,closeTask:Promise<void>|null=null;
 let entryTimer:ReturnType<typeof setInterval>|null=null,entryTask:Promise<unknown>|null=null;
 const prepare=()=>{if(closing||entryTask)return;entryTask=registry.prepareEntries().catch(()=>{}).finally(()=>{entryTask=null;});};
 const listenAbort=new AbortController();let listenerTask:Promise<AddressInfo>|null=null;
 const accepted=new Set<Promise<Response>>();
 const unavailable=()=>Response.json({ok:false,error:'temporarily_unavailable'},{status:503,headers:{'Cache-Control':'no-store, private'}});
 function tracked(task:()=>Promise<Response>){if(closing||!started)return Promise.resolve(unavailable());const promise=Promise.resolve().then(task);accepted.add(promise);void promise.finally(()=>accepted.delete(promise)).catch(()=>{});return promise;}
 const player=(request:Request,id:string)=>tracked(()=>runtime.isActive(id)?rawPlayer(request,id):Promise.resolve(unavailable()));
 const server=createPokerRoomHTTPServer(player,{health:()=>({ready:started&&!closing&&!runtime.health.closed&&runtime.health.pending===0&&runtime.health.failed===0}),lobbyHandler:request=>tracked(()=>rawLobby(request)),managerHandler:request=>tracked(()=>rawManager(request)),ringHandler:options.ringHandler?request=>tracked(()=>options.ringHandler!(request)):undefined});
 let sockets:ReturnType<typeof attachPokerRoomWebSocket>|null=null,ringSockets:{close():Promise<void>}|null=null;
 const close=()=>{
  if(closeTask)return closeTask;closing=true;started=false;
  closeTask=(async()=>{
   if(entryTimer)clearInterval(entryTimer);await entryTask;await options.ringRuntime?.close();
   listenAbort.abort();await Promise.allSettled([listenerTask]);
   // Stop timers immediately. Transport handlers already accepted may finish their
   // durable commit, but cannot admit further traffic or restart the runtime.
   const stopping=runtime.close();
   const listening=server.listening?new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())):Promise.resolve();
   const socketClose=Promise.allSettled([sockets?.close(),ringSockets?.close()]);server.closeIdleConnections();
   await Promise.allSettled([stopping,listening,socketClose]);
   await Promise.allSettled([...accepted]);await registry.drain();
  })();return closeTask;
 };
 const start=():Promise<AddressInfo>=>{
  if(closing)return Promise.reject(new Error('Service closed'));
  if(startTask)return startTask;
  startTask=(async()=>{
   try{
    const discovered=roomIds??await options.registry.directory.startupRooms(options.registry.maxRooms??128);
    if(closing)throw Error('Service closed');await runtime.start(discovered);await options.ringRuntime?.start();if(closing)throw Error('Service closed');
    // Attach only after restoration. Failed rooms remain unavailable while
    // healthy rooms and manager/lobby routes can operate.
    sockets=attachPokerRoomWebSocket(server,{origins,handler:player,owner:id=>registry.owner(id)});
    ringSockets=options.ringEvents?.(server)??null;
    listenerTask=new Promise<AddressInfo>((resolve,reject)=>{
     const cleanup=()=>{server.off('error',error);server.off('listening',listening);listenAbort.signal.removeEventListener('abort',aborted);};
     const error=()=>{cleanup();reject(new Error('Listener unavailable'));};
     const aborted=()=>{cleanup();reject(new Error('Service closed'));};
     const listening=()=>{cleanup();if(closing){server.close();reject(new Error('Service closed'));return;}const address=server.address();if(!address||typeof address==='string'){reject(new Error('Listener unavailable'));return;}started=true;prepare();entryTimer=setInterval(prepare,5000);resolve(address);};
     server.once('error',error);server.once('listening',listening);listenAbort.signal.addEventListener('abort',aborted,{once:true});server.listen({port,host,signal:listenAbort.signal});
    });return await listenerTask;
   }catch{await close();throw new Error('Room service startup failed');}
  })();return startTask;
 };
 // Keep late listener/DNS errors handled even if startup was aborted.
 server.on('error',()=>{if(started)void close();});
 return {start,close,recover:async(id:string)=>{if(closing||!started)throw Error('Service unavailable');await runtime.recover(id);},get health(){return {...runtime.health,listening:started&&!closing};}};
}

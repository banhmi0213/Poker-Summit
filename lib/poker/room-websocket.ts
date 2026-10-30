/** Optional commit invalidations + transport presence. No hand/action/card messages on this channel. */
import {WebSocketServer,WebSocket} from 'ws';
import type {Server,IncomingMessage} from 'node:http';
import type {Duplex} from 'node:stream';
import type {DurableRoomOwner} from './durable-room-owner';
type Options={origins:readonly string[];handler:(request:Request,roomId:string)=>Promise<Response>;owner:(roomId:string)=>Promise<DurableRoomOwner|null>;maxSockets?:number;heartbeatMs?:number;authTimeoutMs?:number};
type Peer={ws:WebSocket;roomId:string;origin:string;token:string;connection:string;owner:DurableRoomOwner|null;unsubscribe:(()=>void)|null;key:string|null;closed:boolean;busy:boolean;again:boolean;alive:boolean;revision:number|null;authTimer:ReturnType<typeof setTimeout>|null;abort:AbortController|null};
export function attachPokerRoomWebSocket(server:Server,options:Options){
 const origins=new Set(options.origins),limit=options.maxSockets??128,heartbeat=options.heartbeatMs??15000,timeout=options.authTimeoutMs??5000;
 if(!origins.size||[...origins].some(o=>{try{return new URL(o).origin!==o||!/^https?:/.test(o);}catch{return true;}})||!Number.isSafeInteger(limit)||limit<1||limit>10000||!Number.isSafeInteger(heartbeat)||heartbeat<20||heartbeat>60000||!Number.isSafeInteger(timeout)||timeout<20||timeout>10000)throw Error('Invalid socket configuration');
 const wss=new WebSocketServer({noServer:true,maxPayload:12288,perMessageDeflate:false}),peers=new Set<Peer>(),current=new Map<string,Peer>(),cleanups=new Set<Promise<unknown>>();let closed=false,checks=0;
 const track=(promise:Promise<unknown>)=>{cleanups.add(promise);void promise.catch(()=>{}).finally(()=>cleanups.delete(promise));};
 function dispose(p:Peer){if(p.closed)return;p.closed=true;peers.delete(p);if(p.authTimer)clearTimeout(p.authTimer);p.abort?.abort();p.unsubscribe?.();p.unsubscribe=null;
  if(p.key&&current.get(p.key)===p){current.delete(p.key);if(p.owner)track(p.owner.disconnectConnection(p.connection));}p.token='';
 }
 function end(p:Peer){dispose(p);p.ws.terminate();}
 async function check(p:Peer){
  if(p.closed||!p.token)return;if(p.busy){p.again=true;return;}if(checks>=limit){end(p);return;}p.busy=true;checks++;
  const abort=new AbortController();p.abort=abort;
  const deadline=setTimeout(()=>{abort.abort();end(p);},timeout);deadline.unref();
  try{
   const response=await options.handler(new Request('http://room.internal/api/poker/rooms/'+p.roomId,{method:'POST',signal:abort.signal,headers:{origin:p.origin,authorization:'Bearer '+p.token,'content-type':'application/json','x-poker-connection':p.connection},body:'{"type":"state"}'}),p.roomId);
   if(p.closed)return;if(response.status!==200)throw Error();const body=await response.json();if(body.ok!==true||!Number.isSafeInteger(body.result?.revision))throw Error();
   if(!p.owner){const owner=await options.owner(p.roomId);if(!owner||p.closed)throw Error();p.owner=owner;
    // Subscribe before the second read; commits during the first read cannot be lost.
    p.unsubscribe=owner.subscribe(()=>{
     // Multi-table tournaments: skip the authorized re-read when this player's own table did not change.
     const hint=p.owner?.revisionHint(p.connection);if(hint!==null&&hint!==undefined&&hint===p.revision)return;void check(p);});p.key=p.roomId+':'+p.connection;
    const old=current.get(p.key);current.set(p.key,p);if(old)end(old);p.again=true;
   }
   if(p.ws.bufferedAmount>16384)throw Error();
   if(p.revision!==body.result.revision){p.ws.send(JSON.stringify({type:p.revision===null?'ready':'changed',revision:body.result.revision}));p.revision=body.result.revision;}
  }catch{end(p);}finally{clearTimeout(deadline);checks--;if(p.abort===abort)p.abort=null;p.busy=false;if(p.again&&!p.closed){p.again=false;void check(p);}}
 }
 const upgrade=(req:IncomingMessage,socket:Duplex,head:Buffer)=>{
  // Ring table pushes have their own handler on the same server (ring-events.ts).
  if((req.url??'').split('?')[0]==='/api/poker/ring/events')return;
  const path=/^\/api\/poker\/rooms\/([a-f0-9-]{36})\/events$/i.exec(req.url??''),origin=req.headers.origin;
  if(closed||!path||typeof origin!=='string'||!origins.has(origin)||peers.size>=limit||req.headers.authorization||req.headers['sec-websocket-protocol']){socket.destroy();return;}
  const duplicates=new Set();for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(name==='origin'){if(duplicates.has(name)){socket.destroy();return;}duplicates.add(name);}}
  wss.handleUpgrade(req,socket,head,ws=>{
   const p:Peer={ws,roomId:path[1].toLowerCase(),origin,token:'',connection:'',owner:null,unsubscribe:null,key:null,closed:false,busy:false,again:false,alive:true,revision:null,authTimer:null,abort:null};peers.add(p);
   p.authTimer=setTimeout(()=>end(p),timeout);p.authTimer.unref();
   ws.on('error',()=>end(p));ws.on('close',()=>dispose(p));ws.on('pong',()=>{p.alive=true;});
   ws.on('message',(bytes,binary)=>{
    if(p.closed||p.token||binary){end(p);return;}
    try{const message=JSON.parse(bytes.toString());if(!message||Object.keys(message).sort().join(',')!=='connectionId,token,type'||message.type!=='subscribe'||typeof message.token!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(message.token)||typeof message.connectionId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(message.connectionId))throw Error();p.token=message.token;p.connection=message.connectionId;if(p.authTimer)clearTimeout(p.authTimer);void check(p);}catch{end(p);}
   });
  });
 };
 server.on('upgrade',upgrade);
 const interval=setInterval(()=>{for(const p of peers){if(!p.alive){end(p);continue;}p.alive=false;p.ws.ping();if(p.token)void check(p);}},heartbeat);interval.unref();
 const close=async()=>{if(closed)return;closed=true;clearInterval(interval);server.off('upgrade',upgrade);for(const p of [...peers])end(p);wss.close();await Promise.allSettled([...cleanups]);};
 server.once('close',()=>{void close();});
 return {close,get activeSockets(){return peers.size;}};
}

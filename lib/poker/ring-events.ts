/** Ring table pushes (owner 2026/10/29: 相手の動きを早く映す／6人でやってあれやと誰もやらん).
 * The browser opens one socket to the game server and subscribes to its table. Every committed change (a move, a timeout,
 * a new hand, a time bank, a stamp) is sent at once as that member's own private view: the same projection the
 * /api/poker/ring answer carries, so nobody sees cards that are not theirs. Moves still go through /api/poker/ring.
 */
import {WebSocketServer,WebSocket} from 'ws';
import type {Server,IncomingMessage} from 'node:http';
import type {Duplex} from 'node:stream';
import type {RingPlayView} from './ring-play-state';
import type {RingTableChange} from './ring-play-runtime';
import type {VerifiedPokerMember} from './request-auth';

export const RING_EVENTS_PATH='/api/poker/ring/events';
type Extras={stamps?:{seat:number;stamp:string;age:number}[];shows?:{seat:number;handId:string;cards:{rank:number;suit:string}[]}[]};
export type RingEventSource={
 subscribe(table:string,listener:(change:RingTableChange)=>void):()=>void;
 latest(table:string):RingTableChange|null;
 viewFor(change:RingTableChange,member:string,playEnabled:boolean):RingPlayView|null;
 /** Ask the runner to read the table now (the first push for a fresh subscriber). */
 tick(table:string):Promise<unknown>;
};
type Options={
 origins:readonly string[];
 verify:(token:string)=>Promise<VerifiedPokerMember>;
 source:RingEventSource;
 /** Whether the member's reservation at this table plays (the lobby's membership.playEnabled). */
 playEnabled:(member:string,table:string)=>Promise<boolean>;
 extras:(table:string)=>Extras;
 maxSockets?:number;heartbeatMs?:number;authTimeoutMs?:number;
 /** The token was checked once; the socket is closed after this long so the browser reconnects with a fresh one. */
 maxAgeMs?:number;
};
type Peer={ws:WebSocket;origin:string;member:string|null;table:string|null;playEnabled:boolean;unsubscribe:(()=>void)|null;closed:boolean;alive:boolean;timers:ReturnType<typeof setTimeout>[];sent:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function attachRingEvents(server:Server,options:Options){
 const origins=new Set(options.origins),limit=options.maxSockets??600,heartbeat=options.heartbeatMs??15000,authTimeout=options.authTimeoutMs??8000,maxAge=options.maxAgeMs??50*60000;
 if(!origins.size||[...origins].some(o=>{try{return new URL(o).origin!==o||!/^https?:/.test(o);}catch{return true;}}))throw Error('Invalid ring event origins');
 const wss=new WebSocketServer({noServer:true,maxPayload:12288,perMessageDeflate:false}),peers=new Set<Peer>(),byTable=new Map<string,Set<Peer>>();let closed=false;
 function dispose(p:Peer){if(p.closed)return;p.closed=true;peers.delete(p);p.timers.forEach(clearTimeout);p.unsubscribe?.();p.unsubscribe=null;if(p.table){const set=byTable.get(p.table);set?.delete(p);if(set&&!set.size)byTable.delete(p.table);}}
 function end(p:Peer,code=1000){dispose(p);try{p.ws.close(code);}catch{p.ws.terminate();}}
 function send(p:Peer,change:RingTableChange|null){
  if(p.closed||!p.member||!p.table)return;
  if(p.ws.bufferedAmount>65536){end(p,1013);return;}
  let play:RingPlayView|null=null;
  if(change){try{play=options.source.viewFor(change,p.member,p.playEnabled);}catch{play=null;}}
  const extras=options.extras(p.table),body=JSON.stringify({type:'table',tableId:p.table,at:change?Date.parse(change.meta.now):null,...(change?{play}:{}),...extras});
  if(body===p.sent)return;p.sent=body;p.ws.send(body);
 }
 async function subscribe(p:Peer,token:string,table:string){
  const who=await options.verify(token);if(p.closed)return;
  const member=String(who?.memberId??'').toLowerCase();if(!UUID.test(member))throw Error('Invalid member');
  p.member=member;p.table=table;p.playEnabled=await options.playEnabled(member,table);if(p.closed)return;
  let set=byTable.get(table);if(!set){set=new Set();byTable.set(table,set);}set.add(p);
  let checkedReservation:string|null=null;
  p.unsubscribe=options.source.subscribe(table,change=>{
   // Who plays or watches can change with the seats: seated and ready means playing, not seated means watching;
   // a seated player who is not ready (or has stepped away) is asked once per reservation.
   const seated=change.meta.context.seats.find(s=>s.memberId===member);
   if(!seated){p.playEnabled=false;checkedReservation=null;send(p,change);return;}
   if(change.meta.ready.includes(seated.reservationId)){p.playEnabled=true;checkedReservation=seated.reservationId;send(p,change);return;}
   if(checkedReservation===seated.reservationId){send(p,change);return;}
   checkedReservation=seated.reservationId;
   void options.playEnabled(member,table).then(v=>{p.playEnabled=v;send(p,options.source.latest(table)??change);},()=>send(p,change));
  });
  p.ws.send(JSON.stringify({type:'ready',tableId:table}));
  const latest=options.source.latest(table);if(latest)send(p,latest);else void options.source.tick(table).catch(()=>{});
  p.timers.push(setTimeout(()=>end(p,4001),maxAge));
 }
 const upgrade=(req:IncomingMessage,socket:Duplex,head:Buffer)=>{
  if((req.url??'').split('?')[0]!==RING_EVENTS_PATH)return;
  const origin=req.headers.origin;
  if(closed||typeof origin!=='string'||!origins.has(origin)||peers.size>=limit||req.headers.authorization||req.headers['sec-websocket-protocol']||(req.url??'').includes('?')){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   const p:Peer={ws,origin,member:null,table:null,playEnabled:false,unsubscribe:null,closed:false,alive:true,timers:[],sent:''};peers.add(p);
   p.timers.push(setTimeout(()=>{if(!p.member)end(p,4000);},authTimeout));
   ws.on('error',()=>end(p));ws.on('close',()=>dispose(p));ws.on('pong',()=>{p.alive=true;});
   ws.on('message',(bytes,binary)=>{
    if(p.closed||binary||p.member||p.table){end(p,4002);return;}
    let token='',table='';
    try{const m=JSON.parse(bytes.toString());if(!m||Object.keys(m).sort().join(',')!=='tableId,token,type'||m.type!=='subscribe'||typeof m.token!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(m.token)||typeof m.tableId!=='string'||!UUID.test(m.tableId))throw Error();token=m.token;table=m.tableId.toLowerCase();}catch{end(p,4002);return;}
    p.table=table;// one subscription per socket
    void subscribe(p,token,table).catch(()=>end(p,4003));
   });
  });
 };
 server.on('upgrade',upgrade);
 const interval=setInterval(()=>{for(const p of peers){if(!p.alive){end(p,1001);continue;}p.alive=false;try{p.ws.ping();}catch{end(p);}}},heartbeat);interval.unref();
 return {
  /** A stamp or a shown card changed at this table. */
  touch(table:string){const set=byTable.get(table);if(!set)return;const latest=options.source.latest(table);for(const p of [...set])send(p,latest);},
  close:async()=>{if(closed)return;closed=true;clearInterval(interval);server.off('upgrade',upgrade);for(const p of [...peers])end(p,1001);await new Promise<void>(r=>wss.close(()=>r()));},
  get activeSockets(){return peers.size;},
 };
}

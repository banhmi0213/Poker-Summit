// Ring table pushes: six players get every committed move at once, only their own cards, and chips never drift.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),Module=require('module'),http=require('http'),{randomUUID,randomBytes}=require('crypto');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const load=Module._load;Module._load=function(r,...a){if(r==='@supabase/supabase-js')return {createClient(){throw Error('no network in tests');}};if(r==='ws'){try{return load.call(this,r,...a);}catch{return load.call(this,'/opt/npm-tools/node_modules/ws',...a);}}return load.call(this,r,...a);};
const WS=Module._load('ws',module);
const {RingPlayRuntime}=require('../lib/poker/ring-play-runtime.ts');
const {attachRingEvents,RING_EVENTS_PATH}=require('../lib/poker/ring-events.ts');
const keys={active:'k1',keys:{k1:randomBytes(32)}};
const ORIGIN='https://ring.test';
function world(n=6){
 const table=randomUUID(),seats=Array.from({length:n},(_,i)=>({reservationId:randomUUID(),memberId:randomUUID(),seat:i+1,stack:1000+i*100})),hands={};
 const context={tableId:table,capacity:6,terms:{sb:50,bb:100},seats,published:true,activeHandId:null,buttonSeat:1};
 let changedAt=Date.now(),now=changedAt,lastHandId=null,completedAt=null;
 const store={timeout:false,from:0,
  async context(){return structuredClone(context);},
  async begin(r){hands[r.handId]={handId:r.handId,tableId:r.tableId,version:1,seats:r.roster,terms:{sb:r.terms.sb,bb:r.terms.bb},buttonSeat:r.terms.buttonSeat,sealed:r.sealed,status:r.result?'complete':'active',result:r.result};context.activeHandId=r.result?null:r.handId;lastHandId=r.handId;changedAt=now;completedAt=r.result?new Date(now).toISOString():null;return 1;},
  async write(r){const h=hands[r.handId];assert.equal(h.version,r.expected);h.version++;h.sealed=r.sealed;h.result=r.result;h.status=r.result?'complete':'active';if(r.result){context.activeHandId=null;completedAt=new Date(now).toISOString();}changedAt=now;return h.version;},
  async load(id){return structuredClone(hands[id]??null);},
  async meta(){return {context:structuredClone(context),now:new Date(now).toISOString(),changedAt:new Date(changedAt).toISOString(),lastHandId,completedAt,runoutFrom:null,ready:seats.map(s=>s.reservationId),penalties:{}};},
  async ping(){},async tables(){return [table];},async cashout(){},
 };
 return {store,seats,table,context,set now(v){now=v;},get now(){return now;}};
}
const total=w=>w.seats.reduce((a,s)=>a+s.stack,0);
function choose(legal,hand,r){const open=Math.max(...hand.players.map(p=>p.committed))===0;if(legal.raise&&r<0.15)return {type:open?'bet':'raise',amount:legal.minRaiseTo};if(legal.check)return {type:'check'};if(r<0.3)return {type:'fold'};return {type:'call'};}

test('six players: every move is pushed at once with only your own cards, and chips are conserved',async()=>{
 const w=world(6),runtime=new RingPlayRuntime({store:()=>w.store,keys});
 const server=http.createServer((_,res)=>{res.writeHead(404);res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port,members=new Map(w.seats.map(s=>[s.memberId,s]));
 const hub=attachRingEvents(server,{origins:[ORIGIN],verify:async token=>({memberId:token}),source:runtime,playEnabled:async()=>true,extras:()=>({})});
 const startTotal=total(w),inbox=new Map(),clients=[];let house=0;
 try{
  for(const s of w.seats){const ws=new WS(`ws://127.0.0.1:${port}${RING_EVENTS_PATH}`,{headers:{origin:ORIGIN}});inbox.set(s.memberId,[]);clients.push(ws);
   await new Promise((res,rej)=>{ws.once('open',res);ws.once('error',rej);});
   ws.on('message',b=>{const m=JSON.parse(b.toString());m.receivedAt=performance.now();inbox.get(s.memberId).push(m);});
   ws.send(JSON.stringify({type:'subscribe',token:s.memberId,tableId:w.table}));}
  await new Promise(r=>setTimeout(r,50));
  for(const s of w.seats)assert.equal(inbox.get(s.memberId)[0]?.type,'ready');
  let moves=0,worst=0,r=0.37;const rand=()=>(r=(r*9301+49297)%233280/233280);
  for(let hand=0;hand<8;hand++){
   w.now+=20000;await runtime.tick(w.table);// starts the next hand (after the result pause)
   for(let guard=0;guard<60;guard++){
    const change=runtime.latest(w.table);assert.ok(change,'a change was published');const h=change.owner.snapshot(null);if(h.result)break;
    const actor=w.seats.find(s=>'seat-'+s.seat===h.toAct),mine=change.owner.snapshot(actor.memberId);
    const before=new Map([...inbox].map(([k,v])=>[k,v.length])),sent=performance.now();
    await runtime.act(actor.memberId,w.table,{handId:h.handId,revision:h.revision,actionId:randomUUID(),action:choose(mine.legal,mine,rand())});moves++;
    // Every player (not just the one who moved) receives the new revision without asking.
    const fresh=m=>m.play&&m.play.hand.handId===h.handId&&m.play.hand.revision>h.revision,deadline=Date.now()+1000;while([...inbox].some(([k,v])=>!v.slice(before.get(k)).some(fresh))&&Date.now()<deadline)await new Promise(r=>setTimeout(r,2));
    for(const [member,list] of inbox){const got=list.slice(before.get(member)).filter(fresh);assert.ok(got.length,'pushed to every seat');const last=got.at(-1);worst=Math.max(worst,last.receivedAt-sent);
     const play=last.play,seat=members.get(member);assert.ok(play,'a seated player gets a play view');assert.equal(play.viewerSeat,'seat-'+seat.seat);
     for(const p of play.hand.players){if(p.id!=='seat-'+seat.seat&&!play.hand.result?.showdown&&!play.hand.runs)assert.equal(p.hole,null,'never someone else\'s cards');}
     assert.ok(play.hand.revision>=h.revision+1);}
   }
   const done=runtime.latest(w.table).owner.snapshot(null);assert.ok(done.result,'hand finished');
   // Settle like the database does at the end of the hand.
   for(const p of done.players){const s=w.seats.find(x=>'seat-'+x.seat===p.id);s.stack=p.stack;}house+=done.result.rake??0;
   w.context.seats=structuredClone(w.seats.filter(s=>s.stack>0));if(w.context.seats.length<2)break;
   w.context.buttonSeat=w.context.seats[(w.context.seats.findIndex(s=>s.seat===w.context.buttonSeat)+1)%w.context.seats.length]?.seat??w.context.seats[0].seat;
   assert.equal(total(w)+house,startTotal,'chips conserved (rake goes to the house)');
  }
  assert.ok(moves>=20,`moves ${moves}`);
  assert.ok(worst<250,`slowest push ${Math.round(worst)}ms`);
 }finally{for(const ws of clients)ws.terminate();await hub.close();await runtime.close();await new Promise(r=>server.close(r));}
});

test('the socket refuses other origins, bad messages and a second subscription',async()=>{
 const w=world(2),runtime=new RingPlayRuntime({store:()=>w.store,keys});
 const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const hub=attachRingEvents(server,{origins:[ORIGIN],verify:async token=>{if(token==='bad')throw Error('no');return {memberId:token};},source:runtime,playEnabled:async()=>false,extras:()=>({stamps:[{seat:1,stamp:'hello',age:0}]})});
 const open=(origin=ORIGIN)=>new Promise(res=>{const ws=new WS(`ws://127.0.0.1:${port}${RING_EVENTS_PATH}`,{headers:{origin}});const out={ws,closed:null,msgs:[]};ws.on('message',b=>out.msgs.push(JSON.parse(b.toString())));ws.on('close',c=>{out.closed=c;});ws.on('error',()=>{out.closed=out.closed??-1;});ws.on('open',()=>res(out));ws.on('unexpected-response',()=>res(out));setTimeout(()=>res(out),300);});
 const wait=()=>new Promise(r=>setTimeout(r,80));
 try{
  const foreign=await open('https://evil.test');await wait();assert.notEqual(foreign.closed,null);
  const bad=await open();bad.ws.send('{"type":"subscribe"}');await wait();assert.equal(bad.closed,4002);
  const badToken=await open();badToken.ws.send(JSON.stringify({type:'subscribe',token:'bad',tableId:w.table}));await wait();assert.equal(badToken.closed,4003);
  const ok=await open(),member=w.seats[0].memberId;ok.ws.send(JSON.stringify({type:'subscribe',token:member,tableId:w.table}));await wait();
  assert.equal(ok.msgs[0].type,'ready');hub.touch(w.table);await wait();assert.deepEqual(ok.msgs.at(-1).stamps,[{seat:1,stamp:'hello',age:0}]);
  ok.ws.send(JSON.stringify({type:'subscribe',token:member,tableId:w.table}));await wait();assert.equal(ok.closed,4002);
 }finally{await hub.close();await runtime.close();await new Promise(r=>server.close(r));}
});

test('browser: a pushed move shows at once, an older read never rolls it back, and the socket reconnects',async()=>{
 const {RingAdmissionClient}=require('../lib/poker/ring-admission-client.ts');
 const w=world(2),runtime=new RingPlayRuntime({store:()=>w.store,keys}),seat=w.seats[0],member=seat.memberId;
 let change;runtime.subscribe(w.table,c=>{change=c;});await runtime.tick(w.table);
 const lobby=play=>({wallet:{available:0,inPlay:seat.stack,total:seat.stack},membership:{reservationId:seat.reservationId,tableId:w.table,seat:seat.seat,stack:seat.stack,status:'seated',title:'T',exitRequested:false,playEnabled:true},tables:[],table:null,play});
 const first=runtime.viewFor(change,member,true);let reply=lobby(first);
 const sockets=[];class FakeSocket{constructor(url){this.url=url;this.sent=[];sockets.push(this);setTimeout(()=>this.onopen?.(),0);}send(x){this.sent.push(JSON.parse(x));}close(){this.closed=true;setTimeout(()=>this.onclose?.(),0);}}
 const client=new RingAdmissionClient({storage:{getItem:()=>null,setItem(){},removeItem(){}},session:async()=>({memberId:member,token:'tok'}),fetch:async()=>Response.json({ok:true,result:reply})});
 client.setMember(member);await client.refresh(w.table);assert.equal(client.getSnapshot().state.play.hand.revision,first.hand.revision);
 const stop=client.listen('wss://rooms.example',w.table,FakeSocket);await new Promise(r=>setTimeout(r,5));
 assert.equal(sockets[0].url,'wss://rooms.example/api/poker/ring/events');assert.deepEqual(sockets[0].sent[0],{type:'subscribe',token:'tok',tableId:w.table});
 sockets[0].onmessage({data:JSON.stringify({type:'ready',tableId:w.table})});assert.equal(client.getSnapshot().live,true);
 // Seat 1 or 2 moves; the push carries the new revision.
 const h=change.owner.snapshot(null),actor=w.seats.find(s=>'seat-'+s.seat===h.toAct),legal=change.owner.snapshot(actor.memberId).legal;
 w.now+=1000;await runtime.act(actor.memberId,w.table,{handId:h.handId,revision:h.revision,actionId:randomUUID(),action:legal.call?{type:'call'}:{type:'check'}});
 const pushed=runtime.viewFor(change,member,true);
 sockets[0].onmessage({data:JSON.stringify({type:'table',tableId:w.table,at:Date.parse(change.meta.now),play:pushed,stamps:[{seat:2,stamp:'nice',age:0}]})});
 assert.equal(client.getSnapshot().state.play.hand.revision,h.revision+1);assert.equal(client.getSnapshot().state.stamps[0].stamp,'nice');
 // A slow read that left before the move must not undo it.
 reply=lobby(first);await client.refresh(w.table);assert.equal(client.getSnapshot().state.play.hand.revision,h.revision+1);
 // A malformed push and one for another table are ignored.
 sockets[0].onmessage({data:'{nope'});sockets[0].onmessage({data:JSON.stringify({type:'table',tableId:randomUUID(),at:Date.now()+9e9,play:null})});assert.equal(client.getSnapshot().state.play.hand.revision,h.revision+1);
 // The socket drops: not live, and it reconnects by itself.
 sockets[0].onclose();assert.equal(client.getSnapshot().live,false);await new Promise(r=>setTimeout(r,1100));assert.equal(sockets.length,2);
 stop();assert.equal(sockets[1].closed,true);
 // Insecure or foreign-looking origins are refused outright.
 const none=client.listen('http://rooms.example',w.table,FakeSocket);none();assert.equal(sockets.length,2);
 await runtime.close();
});

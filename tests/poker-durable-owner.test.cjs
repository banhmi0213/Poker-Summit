const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {randomBytes,randomUUID}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {DurableRoomOwner}=require('../lib/poker/durable-room-owner.ts');
const {openCheckpoint,restoreRoom}=require('../lib/poker/room-persistence.ts');
const T=Date.parse('2026-10-16T10:00:00Z');
const config=()=>({starts_at:new Date(T).toISOString(),structure:{startingStack:1000,anteType:'bb',lateRegLevel:1,reentry:false,periods:[{kind:'level',minutes:1,sb:50,bb:100,ante:100,note:''},{kind:'break',minutes:1,sb:0,bb:0,ante:0,note:''},{kind:'level',minutes:1,sb:100,bb:200,ante:200,note:''}]}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Store {
 value=null;writes=[];failure=null;gate=null;loadError=false;
 block(){const entered=deferred(),release=deferred();this.gate={entered,release};return {entered:entered.promise,release:release.resolve};}
 async load(){if(this.loadError)throw Error('database secret');return structuredClone(this.value);}
 async save(r){this.writes.push(structuredClone(r));const gate=this.gate;this.gate=null;if(gate){gate.entered.resolve();await gate.release.promise;}
  const fail=this.failure;this.failure=null;if(fail==='before')throw Error('offline secret');
  if((this.value?.version??0)!==r.expectedVersion)throw Error('conflict');this.value={version:r.expectedVersion+1,sealed:structuredClone(r.sealed)};
  if(fail==='after')throw Error('response lost');if(fail==='wrong')return 999999;return this.value.version;
 }
}
function options(store=new Store()){let now=T;return {store,roomId:randomUUID(),keys:{active:'k',keys:{k:randomBytes(32)}},now:()=>now,set:n=>now=n};}
async function setup(start=true){const o=options(),owner=await DurableRoomOwner.create(config(),o),tokens={};for(const n of [1,6]){await owner.seat('m'+n,n);tokens[n]=(await owner.connect('m'+n)).connectionId;}if(start)await owner.startHand(6);return {o,owner,tokens};}
const actor=s=>Number(s.hand.toAct.slice(5));
const command=(s,type='call',actionId=randomUUID())=>({handId:s.hand.handId,revision:s.hand.revision,actionId,action:{type}});
async function reconnect(f){for(const n of [1,6])f.tokens[n]=(await f.owner.connect('m'+n)).connectionId;}
const unavailable=/Room unavailable/;
test('creation waits for initial commit and cannot overwrite an existing room',async()=>{
 const o=options(),gate=o.store.block();let returned=false;const p=DurableRoomOwner.create(config(),o).then(v=>{returned=true;return v;});await gate.entered;assert.equal(returned,false);gate.release();const owner=await p;assert.equal(owner.health.version,1);assert.equal(o.store.value.version,1);await assert.rejects(DurableRoomOwner.create(config(),o),unavailable);assert.equal(o.store.value.version,1);
});
test('new connection capability is returned only after its durable commit',async()=>{
 const f=await setup(false),gate=f.o.store.block();let returned=false;const p=f.owner.connect('m1').then(v=>{returned=true;return v;});await gate.entered;const read=f.owner.publicSnapshot();assert.equal(returned,false);gate.release();const connected=await p;assert.ok(connected.connectionId);assert.equal((await read).seats[0].connected,true);await assert.rejects(f.owner.snapshot('m1',f.tokens[1]),/Connection/);
});
test('action acknowledgement and both projections wait behind the write',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s),gate=f.o.store.block();let ack=false,pub=false,priv=false;const action=f.owner.act('m'+n,f.tokens[n],command(s)).then(v=>{ack=true;return v;});await gate.entered;const a=f.owner.publicSnapshot().then(v=>{pub=true;return v;}),b=f.owner.snapshot('m'+n,f.tokens[n]).then(v=>{priv=true;return v;});await Promise.resolve();assert.deepEqual([ack,pub,priv],[false,false,false]);gate.release();const r=await action;assert.equal(r.acceptedRevision,s.hand.revision+1);assert.equal((await a).hand.revision,r.acceptedRevision);assert.equal((await b).hand.revision,r.acceptedRevision);assert.equal(f.owner.health.version,f.o.store.value.version);
});
test('simultaneous actions serialize, second stale action never charges chips',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s),gate=f.o.store.block();const first=f.owner.act('m'+n,f.tokens[n],command(s));await gate.entered;const second=assert.rejects(f.owner.act('m'+n,f.tokens[n],command(s)),/Stale/);gate.release();await first;await second;assert.equal((await f.owner.publicSnapshot()).hand.revision,s.hand.revision+1);assert.equal(f.owner.health.status,'ready');
});
test('duplicate queued packet returns committed receipt without another storage write',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s),c=command(s),gate=f.o.store.block(),count=f.o.store.writes.length;const first=f.owner.act('m'+n,f.tokens[n],c);await gate.entered;const retry=f.owner.act('m'+n,f.tokens[n],c);gate.release();const a=await first,b=await retry;assert.equal(b.replayed,true);assert.equal(a.acceptedRevision,b.acceptedRevision);assert.equal(f.o.store.writes.length,count+1);
});
test('rejected write hides uncommitted state and stops already queued work',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s),gate=f.o.store.block();f.o.store.failure='before';const action=assert.rejects(f.owner.act('m'+n,f.tokens[n],command(s)),unavailable);await gate.entered;const read=assert.rejects(f.owner.publicSnapshot(),unavailable),connect=assert.rejects(f.owner.connect('m1'),unavailable);gate.release();await Promise.all([action,read,connect]);assert.equal(f.owner.health.status,'halted');await assert.rejects(f.owner.snapshot('m1',f.tokens[1]),unavailable);assert.equal(openCheckpoint(f.o.roomId,f.o.store.value.version,f.o.store.value.sealed,f.o.keys).room.hand.commands.length,0);
});
test('failed uncommitted wager reloads prior deal/chips and invalidates every old socket',async()=>{
 const f=await setup(),before=await f.owner.publicSnapshot(),n=actor(before),c=command(before);f.o.store.failure='before';await assert.rejects(f.owner.act('m'+n,f.tokens[n],c),unavailable);const restored=await f.owner.recover();assert.deepEqual(restored.hand,before.hand);assert.ok(restored.seats.every(s=>!s.connected));await assert.rejects(f.owner.snapshot('m'+n,f.tokens[n]),/Connection/);await reconnect(f);const result=await f.owner.act('m'+n,f.tokens[n],c);assert.equal(result.replayed,false);assert.equal(result.acceptedRevision,before.hand.revision+1);
});
test('lost response after commit reloads accepted receipt; retry never applies wager twice',async()=>{
 const f=await setup(),before=await f.owner.publicSnapshot(),n=actor(before),c=command(before);f.o.store.failure='after';await assert.rejects(f.owner.act('m'+n,f.tokens[n],c),unavailable);const state=await f.owner.recover();assert.equal(state.hand.revision,before.hand.revision+1);await reconnect(f);const version=f.owner.health.version,retry=await f.owner.act('m'+n,f.tokens[n],c);assert.equal(retry.replayed,true);assert.equal(f.owner.health.version,version);assert.deepEqual(retry.state.hand.players.map(p=>({...p,hole:null})),state.hand.players);
});
test('load commits recovery state and preserves exact hand/cards/deadline without resets',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),privateBefore=await f.owner.snapshot('m1',f.tokens[1]),v=f.owner.health.version;f.o.set(T+10000);const loaded=await DurableRoomOwner.load(f.o);assert.equal(loaded.health.version,v+1);const state=await loaded.publicSnapshot();assert.deepEqual(state.hand,s.hand);assert.deepEqual(state.turn,s.turn);assert.ok(state.seats.every(s=>!s.connected));const conn=await loaded.connect('m1');assert.deepEqual(conn.state.hand.players.find(p=>p.id==='seat-1').hole,privateBefore.hand.players.find(p=>p.id==='seat-1').hole);
});
test('recovery failure remains halted, including missing/corrupt/temporarily unavailable storage',async()=>{
 const f=await setup();f.o.store.failure='before';await assert.rejects(f.owner.connect('m1'),unavailable);const saved=structuredClone(f.o.store.value);f.o.store.loadError=true;await assert.rejects(f.owner.recover(),unavailable);await assert.rejects(f.owner.publicSnapshot(),unavailable);f.o.store.loadError=false;f.o.store.value=null;await assert.rejects(f.owner.recover(),unavailable);f.o.store.value={...saved,sealed:{...saved.sealed,tag:Buffer.alloc(16).toString('base64')}};await assert.rejects(f.owner.recover(),unavailable);f.o.store.value=saved;await f.owner.recover();assert.equal(f.owner.health.status,'ready');
});
test('bad persistence acknowledgement halts and requires durable reload',async()=>{
 const f=await setup();f.o.store.failure='wrong';await assert.rejects(f.owner.connect('m1'),unavailable);assert.equal(f.owner.health.status,'halted');await f.owner.recover();assert.equal(f.owner.health.version,f.o.store.value.version);
});
test('two stale owners are fenced by CAS; loser cannot return an uncommitted token',async()=>{
 const f=await setup(),loaded=await DurableRoomOwner.load(f.o);await assert.rejects(f.owner.connect('m1'),unavailable);assert.equal(f.owner.health.status,'halted');const t=await loaded.connect('m1');assert.ok(t.connectionId);await assert.rejects(f.owner.publicSnapshot(),unavailable);
});
test('timer mutation is durable; duplicate callback does not save or advance again',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot();f.o.set(s.turn.expiresAt);const gate=f.o.store.block();let ack=false;const p=f.owner.expireTurn(s.turn).then(v=>{ack=true;return v;});await gate.entered;assert.equal(ack,false);gate.release();const result=await p;assert.equal(result.expired,true);const v=f.owner.health.version;assert.equal((await f.owner.expireTurn(s.turn)).expired,false);assert.equal(f.owner.health.version,v);
});
test('expired timer restored after save failure acts only once on committed state',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot();f.o.set(s.turn.expiresAt);f.o.store.failure='after';await assert.rejects(f.owner.expireTurn(s.turn),unavailable);const restored=await f.owner.recover();assert.equal(restored.hand.revision,s.hand.revision+1);assert.equal((await f.owner.expireTurn(s.turn)).expired,false);
});
test('new private deal remains inaccessible on ambiguous start, then loads SAME committed deal',async()=>{
 const f=await setup(false);f.o.store.failure='after';await assert.rejects(f.owner.startHand(6),unavailable);await assert.rejects(f.owner.publicSnapshot(),unavailable);const saved=await restoreRoom(f.o.store,f.o.roomId,f.o.keys,{now:f.o.now}),expected=saved.room.publicSnapshot();const recovered=await f.owner.recover();assert.deepEqual(recovered.hand,expected.hand);assert.equal(recovered.handNumber,1);await reconnect(f);await assert.rejects(f.owner.startHand(6),/already/);
});
test('failed uncommitted start restores waiting state and requires reconnect before new deal',async()=>{
 const f=await setup(false);f.o.store.failure='before';await assert.rejects(f.owner.startHand(6),unavailable);const recovered=await f.owner.recover();assert.equal(recovered.hand,null);await assert.rejects(f.owner.startHand(6),/ready/);await reconnect(f);assert.equal((await f.owner.startHand(6)).handNumber,1);
});
test('terminal action, next hand and leave are durably committed; break/invalid commands stay inert',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s);await f.owner.act('m'+n,f.tokens[n],command(s,'fold'));const done=await f.owner.publicSnapshot();assert.ok(f.o.store.writes.at(-1).result);f.o.set(T+60000);const v=f.owner.health.version;await assert.rejects(f.owner.nextHand(done.hand.handId),/blocked/);assert.equal(f.owner.health.version,v);f.o.set(T+120000);const next=await f.owner.nextHand(done.hand.handId);assert.equal(next.handNumber,2);assert.equal(next.hand.terms.bb,200);assert.equal(f.owner.health.version,v+1);await assert.rejects(f.owner.leave('m1',f.tokens[1]),/live hand/);const waiting=await setup(false);await waiting.owner.leave('m1',waiting.tokens[1]);const load=await DurableRoomOwner.load(waiting.o);assert.equal((await load.publicSnapshot()).seats[0].occupied,false);
});
test('caller payload/deadline mutations during queued save cannot alter captured operations',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s),gate=f.o.store.block(),first=f.owner.connect('m1');await gate.entered;const c=command(s),action=f.owner.act('m'+n,n===1?'stale':f.tokens[n],c);const rejection=n===1?assert.rejects(action,/Connection/):null;c.action.type='fold';c.revision=999;gate.release();await first;if(rejection)await rejection;else assert.equal((await action).state.hand.result,null);
 // Timer payload also snapshots at enqueue, so caller cannot turn a valid callback stale.
 const live=await f.owner.publicSnapshot();f.o.set(live.turn.expiresAt);const g=f.o.store.block(),conn=f.owner.connect('m6');await g.entered;const t=structuredClone(live.turn),expired=f.owner.expireTurn(t);t.handId='tampered';g.release();await conn;assert.equal((await expired).expired,true);
});
test('invalid actions do not poison queue; bounded overload rejects without halting owner',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s),v=f.owner.health.version;await assert.rejects(f.owner.act('m'+n,f.tokens[n],{...command(s),extra:true}));assert.equal(f.owner.health.version,v);await f.owner.act('m'+n,f.tokens[n],command(s));const o=options(),owner=await DurableRoomOwner.create(config(),{...o,maxPending:1}),g=o.store.block(),pending=owner.seat('a',1);await g.entered;await assert.rejects(owner.publicSnapshot(),/queue is full/);g.release();await pending;assert.equal(owner.health.status,'ready');assert.equal(owner.health.pending,0);assert.equal((await owner.publicSnapshot()).seats[0].occupied,true);
});
test('missing storage, invalid config/queue, unavailable key and clone failures never create usable owner',async()=>{
 const o=options();await assert.rejects(DurableRoomOwner.load(o),/not found/);await assert.rejects(DurableRoomOwner.create(config(),{...o,maxPending:0}));await assert.rejects(DurableRoomOwner.create({...config(),starts_at:'bad'},o));await assert.rejects(DurableRoomOwner.create(config(),{...o,keys:{active:'bad',keys:{}}}),unavailable);const f=await setup();await assert.rejects(f.owner.act('m1',f.tokens[1],()=>{}),/Invalid action/);assert.equal(f.owner.health.status,'ready');assert.equal(JSON.stringify(f.owner),'{}');
});
test('acknowledged action survives fresh owner boot and replays using a newly authenticated connection',async()=>{
 const f=await setup(),s=await f.owner.publicSnapshot(),n=actor(s),packet=command(s);const accepted=await f.owner.act('m'+n,f.tokens[n],packet);const boot=await DurableRoomOwner.load(f.o),token=(await boot.connect('m'+n)).connectionId,version=boot.health.version;const retry=await boot.act('m'+n,token,packet);assert.equal(retry.replayed,true);assert.equal(retry.acceptedRevision,accepted.acceptedRevision);assert.equal(boot.health.version,version);assert.deepEqual(retry.state.hand,accepted.state.hand);
});
test('six-player durable tournament saves every decision, restarts between hands and ends with one champion',async()=>{
 const shuffle=require('../lib/poker/server-shuffle.ts'),old=shuffle.shuffleDeck;let seed=11;shuffle.shuffleDeck=deck=>{const a=[...deck];for(let i=a.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 try{const o=options(),cfg=config();cfg.structure.startingStack=200;let owner=await DurableRoomOwner.create(cfg,o),tokens={};for(let n=1;n<=6;n++){await owner.seat('m'+n,n);tokens[n]=(await owner.connect('m'+n)).connectionId;}await owner.startHand(6);
  for(let hand=0;;hand++){assert.ok(hand<40);for(let a=0;!(await owner.publicSnapshot()).hand.result;a++){assert.ok(a<100);const s=await owner.publicSnapshot(),n=actor(s),legal=(await owner.snapshot('m'+n,tokens[n])).hand.legal,action=legal.raise?{type:s.hand.street==='preflop'||!legal.check?'raise':'bet',amount:legal.maxRaiseTo}:legal.check?{type:'check'}:{type:'call'};await owner.act('m'+n,tokens[n],{...command(s),action});assert.equal(owner.health.version,o.store.value.version);}
   const done=await owner.publicSnapshot();assert.equal(done.hand.players.reduce((v,p)=>v+p.stack,0),1200);assert.ok(o.store.writes.at(-1).result);owner=await DurableRoomOwner.load(o);const restored=await owner.publicSnapshot();assert.deepEqual(restored.hand,done.hand);assert.deepEqual(restored.tournament,done.tournament);if(restored.phase==='finished'){assert.equal(restored.tournament.eliminated.length,5);assert.equal(restored.turn,null);await assert.rejects(owner.nextHand(done.hand.handId),/finished/);break;}for(let n=1;n<=6;n++)tokens[n]=(await owner.connect('m'+n)).connectionId;const next=await owner.nextHand(done.hand.handId);assert.equal(next.handNumber,done.handNumber+1);}
 }finally{shuffle.shuffleDeck=old;}
});

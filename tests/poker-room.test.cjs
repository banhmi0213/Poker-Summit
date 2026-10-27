const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {SeatedHandRoom}=require('../lib/poker/seated-hand-room.ts'),{ringTerms}=require('../lib/poker/tournament-hand.ts');
function setup(nums=[1,3,6]){const room=new SeatedHandRoom(1000,ringTerms),connections={};for(const n of nums){room.seat('member-'+n,n);connections[n]=room.connect('member-'+n).connectionId;}return {room,connections};}
const cmd=(s,action,id='action')=>({handId:s.hand.handId,revision:s.hand.revision,actionId:id,action});
const actor=s=>Number(s.hand.toAct.split('-')[1]);
test('one member per seat and one seat per member; reject invalid/full seats',()=>{
 const room=new SeatedHandRoom(1000,ringTerms);for(let i=1;i<=6;i++)room.seat('m'+i,i);const state=room.publicSnapshot();assert.equal(state.seats.filter(s=>s.occupied).length,6);
 for(const [m,n] of [['m1',2],['other',1],['other',0],['other',7],['other',1.5],['',1]])assert.throws(()=>room.seat(m,n));assert.deepEqual(room.publicSnapshot(),state);
});
test('public waiting room contains no account IDs or connection credentials',()=>{
 const {room}=setup(),s=room.publicSnapshot();assert.equal(s.youSeat,null);assert.equal(s.hand,null);assert.ok(!JSON.stringify(s).includes('member-'));assert.ok(!JSON.stringify(s).includes('connectionId'));assert.equal(JSON.stringify(room),'{}');assert.throws(()=>room.connect('outsider'));
});
test('start requires at least two connected seated members and an occupied button',()=>{
 const room=new SeatedHandRoom(1000,ringTerms);room.seat('a',1);room.connect('a');assert.throws(()=>room.startHand(1));room.seat('b',6);assert.throws(()=>room.startHand(1));room.connect('b');assert.throws(()=>room.startHand(2));assert.equal(room.publicSnapshot().hand,null);assert.equal(room.startHand(6).phase,'playing');const sparse=setup([6,1,3]).room.startHand(6);assert.deepEqual(sparse.hand.players.map(p=>p.id),['seat-1','seat-3','seat-6']);assert.deepEqual(sparse.hand.positions,{button:'seat-6',sb:'seat-1',bb:'seat-3',preflopFirst:'seat-6',postflopFirst:'seat-1',nextButtonIndex:0});
});
test('reconnect rotates owner token and invalidates every operation from the old socket',()=>{
 const {room,connections}=setup();room.startHand(6);const before=room.snapshot('member-1',connections[1]),next=room.connect('member-1');assert.notEqual(next.connectionId,connections[1]);assert.deepEqual(next.state.hand,before.hand);
 for(const operation of [()=>room.snapshot('member-1',connections[1]),()=>room.disconnect('member-1',connections[1]),()=>room.act('member-1',connections[1],cmd(before,{type:'fold'})),()=>room.leave('member-1',connections[1])])assert.throws(operation,/current/);
 assert.equal(room.snapshot('member-1',next.connectionId).seats[0].connected,true);
});
test('disconnect retains chips, private cards, actor, hand ID and revision for reconnect',()=>{
 const {room,connections}=setup();room.startHand(6);const before=room.snapshot('member-1',connections[1]);room.disconnect('member-1',connections[1]);const pub=room.publicSnapshot();assert.equal(pub.seats[0].occupied,true);assert.equal(pub.seats[0].connected,false);assert.throws(()=>room.snapshot('member-1',connections[1]));assert.deepEqual(room.connect('member-1').state.hand,before.hand);
});
test('a token belonging to another authenticated account cannot fetch cards or play',()=>{
 const {room,connections}=setup();room.startHand(6);const before=room.publicSnapshot();assert.throws(()=>room.snapshot('member-3',connections[1]));assert.throws(()=>room.act('member-3',connections[1],cmd(before,{type:'call'})));assert.deepEqual(room.publicSnapshot(),before);
});
test('server derives the seat; payload cannot spoof another player or override stacks',()=>{
 const {room,connections}=setup();room.startHand(6);const s=room.publicSnapshot(),n=actor(s);assert.throws(()=>room.act('member-'+n,connections[n],{...cmd(s,{type:'call'}),actorId:'seat-3'}));assert.throws(()=>room.act('member-'+n,connections[n],{...cmd(s,{type:'call'}),stack:999999}));assert.deepEqual(room.publicSnapshot(),s);
 const r=room.act('member-'+n,connections[n],cmd(s,{type:'call'}));assert.equal(r.state.youSeat,n);assert.equal(r.state.hand.players.filter(p=>p.hole).length,1);assert.ok(room.publicSnapshot().hand.players.every(p=>p.hole===null));
});
test('seating and seat release are locked mid-hand; repeated start cannot redeal or charge',()=>{
 const {room,connections}=setup();room.startHand(6);const before=room.publicSnapshot();assert.throws(()=>room.seat('new',2));assert.throws(()=>room.leave('member-1',connections[1]));assert.throws(()=>room.startHand(6));assert.deepEqual(room.publicSnapshot(),before);
});
test('waiting leave releases only that member seat and invalidates its connection',()=>{
 const {room,connections}=setup();room.leave('member-3',connections[3]);assert.equal(room.publicSnapshot().seats[2].occupied,false);assert.throws(()=>room.snapshot('member-3',connections[3]));room.seat('replacement',3);assert.equal(room.connect('replacement').state.youSeat,3);assert.throws(()=>room.act('member-1',connections[1],{}),/not started/);
});
test('retry after reconnect preserves exactly-once chips and gives current room projection',()=>{
 const {room,connections}=setup();room.startHand(6);const s=room.publicSnapshot(),n=actor(s),payload=cmd(s,{type:'call'},'retry');const accepted=room.act('member-'+n,connections[n],payload);const next=room.connect('member-'+n),before=room.publicSnapshot(),retry=room.act('member-'+n,next.connectionId,payload);assert.equal(retry.replayed,true);assert.equal(retry.acceptedRevision,accepted.acceptedRevision);assert.deepEqual(retry.state,next.state);assert.deepEqual(room.publicSnapshot(),before);
});
test('post-hand leave is permitted, final result remains, and replacement/restart remain blocked',()=>{
 const {room,connections}=setup([1,6]);room.startHand(6);const s=room.publicSnapshot(),n=actor(s);room.act('member-'+n,connections[n],cmd(s,{type:'fold'}));const end=room.publicSnapshot();assert.equal(end.phase,'complete');assert.equal(end.hand.players.reduce((v,p)=>v+p.stack,0),2000);room.leave('member-'+n,connections[n]);assert.deepEqual(room.publicSnapshot().hand,end.hand);assert.throws(()=>room.connect('member-'+n));assert.throws(()=>room.seat('new',n));assert.throws(()=>room.startHand(6));
});
test('100 reconnects preserve the same hand and invalidate all retired sessions',()=>{
 const {room,connections}=setup();room.startHand(6);const hand=room.snapshot('member-1',connections[1]).hand;let old=connections[1];for(let i=0;i<100;i++){const session=room.connect('member-1');assert.deepEqual(session.state.hand,hand);assert.throws(()=>room.disconnect('member-1',old));assert.throws(()=>room.snapshot('member-1',old));old=session.connectionId;}assert.equal(room.snapshot('member-1',old).seats[0].connected,true);assert.throws(()=>new SeatedHandRoom(Number.MAX_SAFE_INTEGER,ringTerms));
});

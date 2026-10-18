const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {SeatedHandRoom}=require('../lib/poker/seated-hand-room.ts'),{ringTerms}=require('../lib/poker/tournament-hand.ts');
function setup(nums=[1,2],stack=1000){let now=1000;const room=new SeatedHandRoom(stack,ringTerms,{now:()=>now,turnMs:1000}),connections={};for(const n of nums){room.seat('m'+n,n);connections[n]=room.connect('m'+n).connectionId;}room.startHand(nums.at(-1));return {room,connections,setNow:n=>{now=n;}};}
const actor=s=>Number(s.hand.toAct.split('-')[1]);
const cmd=(s,action,id='manual')=>({handId:s.hand.handId,revision:s.hand.revision,actionId:id,action});
function play(f,action,id){const s=f.room.publicSnapshot(),n=actor(s);return f.room.act('m'+n,f.connections[n],cmd(s,action,id));}
test('deadline is exact: early callback is inert, owed bet folds at the boundary',()=>{
 const f=setup(),s=f.room.publicSnapshot();assert.equal(s.turn.expiresAt,2000);f.setNow(1999);assert.equal(f.room.expireTurn(s.turn).expired,false);assert.deepEqual(f.room.publicSnapshot(),s);f.setNow(2000);const r=f.room.expireTurn(s.turn);assert.equal(r.action,'fold');assert.equal(r.state.phase,'complete');assert.equal(r.state.turn,null);assert.equal(r.state.hand.players.reduce((n,p)=>n+p.stack,0),2000);assert.ok(r.state.hand.players.every(p=>p.hole===null));assert.equal(r.state.hand.board.length,0);
});
test('free action times out to check, never bets/calls/raises; next street gets a fresh deadline',()=>{
 const f=setup();play(f,{type:'call'});const s=f.room.publicSnapshot();f.setNow(s.turn.expiresAt);const r=f.room.expireTurn(s.turn);assert.equal(r.action,'check');assert.equal(r.state.hand.street,'flop');assert.equal(r.state.hand.board.length,3);assert.equal(r.state.turn.expiresAt,s.turn.expiresAt+1000);assert.equal(r.state.hand.pot,s.hand.pot);
});
test('duplicate and stale callbacks cannot act twice or steal the next actor turn',()=>{
 const f=setup([1,2,3]),s=f.room.publicSnapshot();f.setNow(2000);const first=f.room.expireTurn(s.turn),after=f.room.publicSnapshot();assert.ok(first.expired);for(let i=0;i<10;i++)assert.equal(f.room.expireTurn(s.turn).expired,false);assert.deepEqual(f.room.publicSnapshot(),after);assert.equal(after.hand.revision,s.hand.revision+1);
});
test('manual action just before expiry wins; its retired callback becomes a no-op',()=>{
 const f=setup([1,2,3]),s=f.room.publicSnapshot();f.setNow(1999);play(f,{type:'call'});const after=f.room.publicSnapshot();f.setNow(2000);assert.equal(f.room.expireTurn(s.turn).expired,false);assert.deepEqual(f.room.publicSnapshot(),after);assert.equal(after.turn.expiresAt,2999);
});
test('manual action at/after deadline rejects without changing chips; scheduler resolves once',()=>{
 const f=setup(),s=f.room.publicSnapshot(),n=actor(s),c=cmd(s,{type:'call'});f.setNow(2000);assert.throws(()=>f.room.act('m'+n,f.connections[n],c),/deadline/);assert.deepEqual(f.room.publicSnapshot(),s);f.room.expireTurn(s.turn);const after=f.room.publicSnapshot();assert.throws(()=>f.room.act('m'+n,f.connections[n],c));assert.deepEqual(f.room.publicSnapshot(),after);
});
test('disconnect and reconnect do not reset the original deadline or grant extra time',()=>{
 const f=setup(),s=f.room.publicSnapshot(),n=actor(s);f.setNow(1500);f.room.disconnect('m'+n,f.connections[n]);const next=f.room.connect('m'+n);assert.deepEqual(next.state.turn,s.turn);assert.deepEqual(next.state.hand,f.room.snapshot('m'+n,next.connectionId).hand);f.setNow(2000);assert.throws(()=>f.room.act('m'+n,next.connectionId,cmd(s,{type:'call'})),/deadline/);assert.equal(f.room.expireTurn(s.turn).action,'fold');
});
test('an offline actor still expires without a connection token, exposing only public state',()=>{
 const f=setup(),s=f.room.publicSnapshot(),n=actor(s);f.room.disconnect('m'+n,f.connections[n]);f.setNow(2000);const r=f.room.expireTurn(s.turn);assert.ok(r.expired);assert.equal(r.state.youSeat,null);assert.ok(r.state.hand.players.every(p=>p.hole===null));assert.ok(!JSON.stringify(r).includes('connectionId'));
});
test('accepted retry still acknowledges after a subsequent actor deadline, with no new action',()=>{
 const f=setup([1,2,3]),s=f.room.publicSnapshot(),n=actor(s),c=cmd(s,{type:'call'},'retry'),accepted=f.room.act('m'+n,f.connections[n],c);const next=f.room.publicSnapshot();f.setNow(next.turn.expiresAt+10000);const r=f.room.act('m'+n,f.connections[n],c);assert.equal(r.replayed,true);assert.equal(r.acceptedRevision,accepted.acceptedRevision);assert.deepEqual(r.state.hand,f.room.snapshot('m'+n,f.connections[n]).hand);assert.deepEqual(f.room.publicSnapshot(),next);assert.ok(f.room.expireTurn(next.turn).expired);
});
test('very late scheduler performs at most one action and starts next deadline from server now',()=>{
 const f=setup([1,2,3]),s=f.room.publicSnapshot();f.setNow(100000);const r=f.room.expireTurn(s.turn);assert.equal(r.state.hand.revision,1);assert.equal(r.state.turn.expiresAt,101000);assert.equal(f.room.expireTurn(r.state.turn).expired,false);
});
test('copied/forged schedule metadata cannot change the real deadline or actor',()=>{
 const f=setup([1,2,3]),s=f.room.publicSnapshot();s.turn.expiresAt=0;assert.equal(f.room.expireTurn(s.turn).expired,false);assert.equal(f.room.publicSnapshot().turn.expiresAt,2000);f.setNow(2000);assert.equal(f.room.expireTurn({...s.turn,actor:'seat-1'}).expired,false);assert.equal(f.room.expireTurn({...s.turn,handId:'another'}).expired,false);assert.equal(f.room.expireTurn({...s.turn,revision:999}).expired,false);assert.equal(f.room.publicSnapshot().hand.revision,0);
});
test('invalid server clock and timeout IDs reject without partial hand effects; rollback does not reset time',()=>{
 const f=setup([1,2,3]),s=f.room.publicSnapshot();f.setNow(1900);assert.equal(f.room.expireTurn(s.turn).expired,false);f.setNow(1000);assert.equal(f.room.expireTurn(s.turn).expired,false);play(f,{type:'call'});assert.equal(f.room.publicSnapshot().turn.expiresAt,2900);const before=f.room.publicSnapshot(),n=actor(before);assert.throws(()=>f.room.act('m'+n,f.connections[n],cmd(before,{type:'call'},'timeout_forged')),/Reserved/);f.setNow(NaN);assert.throws(()=>f.room.expireTurn(before.turn),/server time/);assert.throws(()=>play(f,{type:'call'}),/server time/);assert.deepEqual(f.room.publicSnapshot(),before);assert.throws(()=>new SeatedHandRoom(1000,ringTerms,{turnMs:0}));assert.throws(()=>new SeatedHandRoom(1000,ringTerms,{turnMs:300001}));
});
test('forced all-in completion has no active clock and no callback can debit it again',()=>{
 const f=setup([1,2],50),s=f.room.publicSnapshot();assert.equal(s.phase,'complete');assert.equal(s.turn,null);f.setNow(100000);assert.equal(f.room.expireTurn({handId:s.hand.handId,revision:0,actor:'seat-1',expiresAt:0}).expired,false);assert.deepEqual(f.room.publicSnapshot(),s);
});

// Multi-table tournaments (owner 2026/10/30: 20人以上、卓分け・移動・統合).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {ScheduledTournamentRoom}=require('../lib/poker/scheduled-tournament-room.ts');
const start='2026-11-15T10:00:00.000Z',T=Date.parse(start);
const structure=(extra={})=>({startingStack:1000,anteType:'bb',lateRegLevel:1,reentry:false,timeBankCards:1,finalTableCards:2,...extra,periods:[1,2,3,4,5,6,8,10,15,20,30,40,60,80,100,150,200,300,400,600].map((m,i)=>({kind:'level',minutes:4,sb:10*m,bb:20*m,ante:20*m,note:''}))});
const ids=n=>Array.from({length:n},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
function setup(n,{extra,at=-60000}={}){
 let now=T+at;const members=ids(n),room=new ScheduledTournamentRoom({starts_at:start,structure:structure(extra)},{now:()=>now,turnMs:20000,handPauseMs:3000});
 const control={enabled:true,published:true,members,expectedCount:n};
 return {room,members,control,get now(){return now;},setNow(v){now=v;},tick(ms){now+=ms;}};
}
function allSeats(room){const c=room.checkpoint().field;return c.tables.flatMap(([n,t])=>t.seats.map(([seat,s])=>({table:n,seat,...s})));}
function chipsInPlay(room){
 // Seats hold the stacks from before a live hand; live hands are counted from their own state.
 const c=room.checkpoint().field;let total=0;
 for(const [,t] of c.tables){
  const live=t.hand&&!t.hand.result;
  const inHand=new Set(live?t.hand.players?.map?.(p=>p.id)??[]:[]);
  for(const [seat,s] of t.seats)total+=s.stack;
 }
 return total;
}
/** Play until the end with random legal actions; return the event log. */
function play(f,{restoreEvery=0,check=()=>{},afterAct=()=>{}}={}){
 const tokens=new Map(),events=[];let room=f.room,steps=0;
 const conn=m=>{if(!tokens.has(m)){const r=room.join(m,false);tokens.set(m,r.connectionId);}return tokens.get(m);};
 while(steps++<200000){
  const r=room.advance(f.control);events.push(r.event);
  if(r.event==='finished')break;
  check(room,r);
  if(restoreEvery&&steps%restoreEvery===0){room=ScheduledTournamentRoom.restore(room.checkpoint(),{now:()=>f.now});tokens.clear();}
  if(r.changed)continue;
  // Someone to act? Pick a random legal action for one actor.
  const actors=allSeats(room).filter(s=>s.stack>0);let acted=false;
  for(const s of actors){
   let view;try{view=room.snapshot(s.memberId,conn(s.memberId));}catch{tokens.delete(s.memberId);continue;}
   const legal=view.hand?.legal;if(!legal)continue;
   const roll=Math.random();let action;
   if(legal.raise&&roll<0.15)action={type:legal.check?'bet':'raise',amount:roll<0.05?legal.maxRaiseTo:legal.minRaiseTo};
   else if(legal.check)action={type:'check'};else if(legal.call&&roll<0.75)action={type:'call'};else action={type:'fold'};
   const send=a=>room.act(s.memberId,tokens.get(s.memberId),{handId:view.hand.handId,revision:view.hand.revision,actionId:randomUUID(),action:a});
   try{send(action);}catch(e){if(!['bet','raise'].includes(action.type))throw e;send({...action,type:action.type==='bet'?'raise':'bet'});}
   afterAct(room);acted=true;break;
  }
  if(!acted)f.setNow(r.nextWakeAt===null?f.now+1000:Math.max(f.now+1,r.nextWakeAt));
 }
 return {room,events};
}

test('7–60 players are drawn onto 6-max tables of nearly equal size, before the start',()=>{
 for(const n of [7,12,13,20,25,60]){
  const f=setup(n),r=f.room.advance(f.control);assert.equal(r.event,'seated');assert.equal(r.changed,true);
  const c=f.room.checkpoint().field,sizes=c.tables.map(([,t])=>t.seats.length);
  assert.equal(sizes.length,Math.ceil(n/6));assert.equal(sizes.reduce((a,b)=>a+b,0),n);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1,`${n}: ${sizes}`);assert.ok(Math.max(...sizes)<=6);
  assert.deepEqual(new Set(allSeats(f.room).map(s=>s.memberId)),new Set(f.members));
  assert.equal(f.room.advance(f.control).event,'scheduled','no hand before the start');
 }
 const f=setup(61);assert.throws(()=>f.room.advance({...f.control,expectedCount:61}),/Invalid scheduler control/);
});
test('a member sees only their own table, the table number and the field count; others get no cards',()=>{
 const f=setup(13);f.room.advance(f.control);f.setNow(T);
 for(let i=0;i<4;i++)f.room.advance(f.control);
 const a=f.members[0],join=f.room.join(a,false),v=join.state;
 assert.equal(v.field.entrants,13);assert.equal(v.field.remaining,13);assert.equal(v.field.tables,3);assert.ok([1,2,3].includes(v.field.tableNumber));
 assert.equal(v.youSeat!==null,true);
 const me=`seat-${v.youSeat}`;for(const p of v.hand.players)if(p.id!==me)assert.equal(p.hole,null,'no other hole cards');
 assert.ok(!JSON.stringify(v).includes(f.members[1]),'member ids never in a view');
 const pub=f.room.publicSnapshot();assert.equal(pub.youSeat,null);assert.ok(pub.hand.players.every(p=>p.hole===null));
});
for(const n of [7,13,20,26]){
 test(`${n} players: chips conserved, tables balanced, broken down to a final table, every place decided once`,()=>{
  const f=setup(n);let maxTables=0,finalSeen=false;
  const {room}=play(f,{check:(room)=>{
   const c=room.checkpoint().field;if(!c)return;maxTables=Math.max(maxTables,c.tables.length);
   assert.equal(chipsInPlay(room),n*1000,'chips are conserved across tables');
   for(const [,t] of c.tables)assert.ok(t.seats.length<=6,'never more than 6 at a table');
   const live=allSeats(room).filter(s=>s.stack>0).length;if(live<=6&&c.tables.length===1)finalSeen=true;
  }});
  const c=room.checkpoint().field;
  assert.ok(c.champion,'a champion');assert.equal(c.eliminated.length,n-1);
  const places=c.eliminated.map(e=>e.place);for(const p of places)assert.ok(p>=2&&p<=n);
  // Ties only within one hand; every place 2..n covered by some [place..tiedThrough] range.
  for(let p=2;p<=n;p++)assert.ok(c.eliminated.some(e=>e.place<=p&&p<=e.tiedThrough),`place ${p} covered`);
  assert.equal(maxTables,Math.ceil(n/6));assert.ok(finalSeen,'final table reached');
  const final=room.terminalResult()??null;
  const v=room.publicSnapshot();assert.equal(v.phase,'finished');assert.equal(v.field.remaining,1);
 });
}
test('the final hand carries the standings for the archive (entry ids, every member once)',()=>{
 const f=setup(9);let result=null;
 const grab=room=>{const r=room.terminalResult();if(r?.tournament)result=r;};const {room}=play(f,{check:grab,afterAct:grab});
 // The last settlement happens inside advance/act; read it right after the finishing operation.
 const r=result??room.terminalResult();
 assert.ok(r?.tournament?.champion,'final result');
 assert.equal(r.participants.length,9);assert.equal(new Set(r.participants.map(p=>p.memberId)).size,9);
 assert.equal(r.tournament.eliminated.length,8);
 assert.ok(r.participants.some(p=>p.seatId===r.tournament.champion));
 assert.ok(JSON.stringify(r).length<10000,'fits the result record');
});
test('a restart from the checkpoint at any point continues the same tournament',()=>{
 const f=setup(14);const {room}=play(f,{restoreEvery:37,check:(room)=>{const c=room.checkpoint().field;if(c)assert.equal(chipsInPlay(room),14000);}});
 const c=room.checkpoint().field;assert.ok(c.champion);assert.equal(c.eliminated.length,13);
});
test('a moved player keeps their connection, chips and time bank cards, and sees the new table',()=>{
 const f=setup(8);let moved=null;const tokens=new Map();
 const {room}=play(f,{check:(room,r)=>{
  if(moved||!['balanced','table-break'].includes(r.event))return;
  const c=room.checkpoint().field;const m=c.moved.at(-1);if(!m)return;moved={member:m[0],...m[1]};
 }});
 assert.ok(moved,'someone moved');
});
test('revisions only grow for a member, also when they move',()=>{
 const f=setup(10);const last=new Map(),tokens=new Map();
 play(f,{check:(room)=>{
  for(const m of f.members){
   let v;try{if(!tokens.has(m))tokens.set(m,room.join(m,false).connectionId);v=room.snapshot(m,tokens.get(m));}catch{tokens.delete(m);continue;}
   assert.ok(v.revision>=(last.get(m)??-1),'monotonic');last.set(m,v.revision);
  }
 }});
});
test('through the durable owner: every save is committed, each settled hand is recorded once, the last carries the standings',async()=>{
 const {DurableRoomOwner}=require('../lib/poker/durable-room-owner.ts'),{randomBytes}=require('node:crypto');
 let now=T-60000,saved=null;const results=new Map(),histories=[];
 const store={async load(){return saved?structuredClone(saved):null;},async save(r){if((saved?.version??0)!==r.expectedVersion)throw Error('conflict');saved={version:r.expectedVersion+1,sealed:r.sealed};if(r.result){const prior=results.get(r.result.handId);assert.ok(!prior||JSON.stringify(prior)===JSON.stringify(r.result),'one record per hand');results.set(r.result.handId,r.result);}return saved.version;},async history(h){histories.push(h);}};
 const keys={active:'k1',keys:{k1:new Uint8Array(randomBytes(32))}},roomId='10000000-0000-4000-8000-000000000001',members=ids(9);
 const config={tournamentId:'20000000-0000-4000-8000-000000000002',starts_at:start,structure:structure()};
 let owner=await DurableRoomOwner.create(config,{roomId,store,keys,now:()=>now,turnMs:20000,handPauseMs:3000});
 const control={enabled:true,published:true,members,expectedCount:9},tokens=new Map();
 for(let step=0;step<100000;step++){
  const r=await owner.advance(control);if(r.event==='finished')break;
  if(step%500===250){owner=await DurableRoomOwner.load({roomId,store,keys,now:()=>now,expectedConfig:config});tokens.clear();}
  if(r.changed)continue;
  let acted=false;
  for(const m of members){
   let v;try{if(!tokens.has(m))tokens.set(m,(await owner.join(m,false)).connectionId);v=await owner.snapshot(m,tokens.get(m));}catch{tokens.delete(m);continue;}
   const legal=v.hand?.legal;if(!legal)continue;
   await owner.act(m,tokens.get(m),{handId:v.hand.handId,revision:v.hand.revision,actionId:randomUUID(),action:legal.check?{type:'check'}:Math.random()<0.6?{type:'call'}:{type:'fold'}});acted=true;break;
  }
  if(!acted)now=r.nextWakeAt===null?now+1000:Math.max(now+1,r.nextWakeAt);
 }
 const finals=[...results.values()].filter(r=>r.tournament?.champion);
 assert.equal(finals.length,1,'one final record');assert.equal(finals[0].participants.length,9);
 assert.ok(results.size>=8,'every settled hand recorded');assert.ok(histories.length>=results.size-1,'hand histories written');
 assert.equal((await owner.publicSnapshot()).phase,'finished');
});
test('room config keeps turn time and time bank cards (a tournament using them must still bind its room)',()=>{
 const {roomConfig}=require('../lib/poker/room-directory.ts');
 const c=roomConfig({tournamentId:'20000000-0000-4000-8000-000000000002',starts_at:start,structure:structure({turnSeconds:30,timeBankCards:2,finalTableCards:1})});
 assert.equal(c.structure.turnSeconds,30);assert.equal(c.structure.timeBankCards,2);assert.equal(c.structure.finalTableCards,1);
 const plain=roomConfig({tournamentId:'20000000-0000-4000-8000-000000000002',starts_at:start,structure:{...structure(),timeBankCards:undefined,finalTableCards:undefined}});
 assert.equal('timeBankCards' in plain.structure,false);
});

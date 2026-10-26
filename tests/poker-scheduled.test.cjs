const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {ScheduledTournamentRoom}=require('../lib/poker/scheduled-tournament-room.ts');
const start='2026-10-16T10:00:00.000Z',T=Date.parse(start);
const config=()=>({starts_at:start,structure:{startingStack:10000,anteType:'bb',lateRegLevel:2,reentry:false,periods:[{kind:'level',minutes:1,sb:50,bb:100,ante:100,note:''},{kind:'level',minutes:1,sb:75,bb:150,ante:150,note:''},{kind:'break',minutes:1,sb:0,bb:0,ante:0,note:'休憩'},{kind:'level',minutes:1,sb:100,bb:200,ante:200,note:''}]}});
function setup(at=0,turnMs=300000){let now=T+at;const room=new ScheduledTournamentRoom(config(),{now:()=>now,turnMs}),tokens={};for(const n of [1,6]){room.seat('m'+n,n);tokens[n]=room.connect('m'+n).connectionId;}return {room,tokens,setNow:offset=>{now=T+offset;}};}
const command=(s,action,id='a')=>({handId:s.hand.handId,revision:s.hand.revision,actionId:id,action});
function fold(f){const s=f.room.publicSnapshot(),n=Number(s.hand.toAct.slice(5));return f.room.act('m'+n,f.tokens[n],command(s,{type:'fold'}));}
const chips=s=>s.hand.players.reduce((v,p)=>v+p.stack,0)+s.hand.pot;
test('before start no hand/blinds; exact scheduled boundary enables initial hand',()=>{
 const f=setup(-1),s=f.room.publicSnapshot();assert.equal(s.clock.phase,'scheduled');assert.equal(s.canStartHand,false);assert.throws(()=>f.room.startHand(6),/blocked/);assert.deepEqual(f.room.publicSnapshot(),s);f.setNow(0);assert.equal(f.room.publicSnapshot().canStartHand,true);const h=f.room.startHand(6);assert.equal(h.hand.terms.level,1);assert.equal(h.hand.terms.bb,100);assert.equal(h.hand.pot,250);assert.equal(h.turn.expiresAt,T+300000);assert.equal(chips(h),20000);
});
test('late initial start selects current level rather than charging level one',()=>{
 const f=setup(90000),s=f.room.startHand(6);assert.equal(s.clock.level,2);assert.equal(s.hand.terms.level,2);assert.equal(s.hand.terms.sb,75);assert.equal(s.hand.terms.bb,150);assert.equal(s.hand.terms.ante,150);assert.equal(s.hand.pot,375);assert.equal(chips(s),20000);
 for(const type of ['none','per-player']){let now=T;const cfg=config();cfg.structure.anteType=type;if(type==='none')for(const p of cfg.structure.periods)p.ante=0;const r=new ScheduledTournamentRoom(cfg,{now:()=>now});r.seat('a',1);r.seat('b',6);r.connect('a');const b=r.connect('b').connectionId;let h=r.startHand(6);assert.equal(h.hand.pot,type==='none'?150:350);r.act('b',b,command(h,{type:'fold'}));h=r.publicSnapshot();now=T+60000;h=r.nextHand(h.hand.handId);assert.equal(h.hand.pot,type==='none'?225:525);assert.equal(h.hand.terms.anteType,type);assert.equal(chips(h),20000);}
});
test('clock level transition leaves current hand frozen; next hand uses exact new terms',()=>{
 const f=setup();f.room.startHand(6);f.setNow(60000);const s=f.room.publicSnapshot();assert.equal(s.clock.level,2);assert.equal(s.hand.terms.level,1);assert.equal(s.hand.terms.bb,100);assert.equal(s.hand.terms.ante,100);fold(f);const done=f.room.publicSnapshot(),next=f.room.nextHand(done.hand.handId);assert.equal(next.hand.terms.level,2);assert.equal(next.hand.pot,375);assert.equal(chips(next),20000);assert.equal(next.turn.expiresAt,T+360000);
});
test('break blocks an initial start without charging or changing readiness',()=>{
 const f=setup(120000),s=f.room.publicSnapshot();assert.equal(s.clock.phase,'break');assert.equal(s.clock.remaining,60);assert.equal(s.canStartHand,false);assert.throws(()=>f.room.startHand(6),/blocked/);assert.deepEqual(f.room.publicSnapshot(),s);assert.equal(s.hand,null);
});
test('hand may finish during break, but next hand remains blocked without mutation',()=>{
 const f=setup();f.room.startHand(6);f.setNow(120000);fold(f);const s=f.room.publicSnapshot();assert.equal(s.phase,'complete');assert.equal(s.clock.phase,'break');assert.equal(s.hand.terms.bb,100);assert.equal(s.canStartHand,false);assert.throws(()=>f.room.nextHand(s.hand.handId),/blocked/);assert.deepEqual(f.room.publicSnapshot(),s);assert.equal(chips(s),20000);
});
test('turn expiry still checks/folds current hand during break, returning public state',()=>{
 const f=setup(0,130000),h=f.room.startHand(6);f.setNow(130000);const r=f.room.expireTurn(h.turn);assert.equal(r.expired,true);assert.equal(r.action,'fold');assert.equal(r.state.clock.phase,'break');assert.equal(r.state.canStartHand,false);assert.ok(r.state.hand.result);assert.equal(r.state.youSeat,null);assert.ok(r.state.hand.players.every(p=>p.hole===null));assert.equal(chips(r.state),20000);
});
test('exact break end resumes current level with BB ante once, carrying prior winnings',()=>{
 const f=setup();f.room.startHand(6);fold(f);const done=f.room.publicSnapshot();f.setNow(179999);assert.throws(()=>f.room.nextHand(done.hand.handId),/blocked/);f.setNow(180000);const next=f.room.nextHand(done.hand.handId);assert.equal(next.clock.phase,'level');assert.equal(next.hand.terms.level,3);assert.equal(next.hand.terms.sb,100);assert.equal(next.hand.terms.bb,200);assert.equal(next.hand.terms.ante,200);assert.equal(next.hand.pot,500);for(const p of next.hand.players)assert.equal(p.stack+p.totalCommitted,done.tournament.stacks[p.id]);assert.equal(chips(next),20000);
});
test('expired final schedule keeps its last blinds and permits hands, not a false tournament end',()=>{
 const f=setup();f.room.startHand(6);fold(f);const done=f.room.publicSnapshot();f.setNow(600000);const s=f.room.publicSnapshot();assert.equal(s.clock.phase,'final');assert.equal(s.clock.remaining,0);assert.equal(s.canStartHand,true);assert.equal(s.phase,'complete');const next=f.room.nextHand(done.hand.handId);assert.equal(next.hand.terms.level,3);assert.equal(next.hand.terms.bb,200);assert.equal(next.hand.terms.ante,200);assert.equal(next.phase,'playing');assert.equal(chips(next),20000);
});
test('input and projected schedule objects are isolated and unknown fields never broadcast',()=>{
 let now=T;const cfg=config();cfg.structure.periods[0].secret='PRIVATE';const r=new ScheduledTournamentRoom(cfg,{now:()=>now});cfg.structure.periods[0].bb=999999;cfg.structure.startingStack=1;const s=r.publicSnapshot();assert.equal(s.clock.period.bb,100);assert.ok(!JSON.stringify(s).includes('PRIVATE'));s.clock.period.bb=1;s.clock.next.bb=1;s.clock.following.bb=1;assert.equal(r.publicSnapshot().clock.period.bb,100);assert.equal(r.publicSnapshot().clock.next.bb,150);r.seat('a',1);r.seat('b',6);r.connect('a');r.connect('b');assert.equal(r.startHand(6).hand.players.reduce((n,p)=>n+p.stack+p.totalCommitted,0),20000);
});
test('invalid structure/date/server clock cannot create or mutate a playable state',()=>{
 assert.throws(()=>new ScheduledTournamentRoom({...config(),starts_at:'bad'}));assert.throws(()=>new ScheduledTournamentRoom({...config(),starts_at:42}));const c=config();c.structure.periods[0].bb=0;assert.throws(()=>new ScheduledTournamentRoom(c));assert.throws(()=>new ScheduledTournamentRoom(config(),{turnMs:0}));assert.throws(()=>new ScheduledTournamentRoom(config(),{now:42}));const f=setup(),before=f.room.publicSnapshot();f.setNow(NaN);assert.throws(()=>f.room.startHand(6),/server time/);f.setNow(0);assert.deepEqual(f.room.publicSnapshot(),before);
});
test('clock catches up across levels/breaks, exposes next break and does not roll backwards',()=>{
 const f=setup();f.setNow(60000);let s=f.room.publicSnapshot();assert.equal(s.clock.level,2);assert.equal(s.clock.following.kind,'break');assert.equal(s.clock.registrationOpen,true);f.setNow(1000);assert.equal(f.room.publicSnapshot().serverNow,T+60000);f.setNow(120000);s=f.room.publicSnapshot();assert.equal(s.clock.registrationOpen,false);assert.equal(s.clock.phase,'break');f.setNow(180000);s=f.room.publicSnapshot();assert.equal(s.clock.level,3);assert.equal(s.clock.following,null);
});
test('player time/term overrides reject; start captures one sample and stale next instructions stay inert',()=>{
 const f=setup();const h=f.room.startHand(6),n=Number(h.hand.toAct.slice(5));assert.throws(()=>f.room.act('m'+n,f.tokens[n],{...command(h,{type:'call'}),now:T-999999}));assert.deepEqual(f.room.publicSnapshot(),h);fold(f);const done=f.room.publicSnapshot();f.setNow(60000);const next=f.room.nextHand(done.hand.handId,{sb:1,bb:1,ante:0});assert.equal(next.hand.terms.bb,150);assert.throws(()=>f.room.nextHand(done.hand.handId));assert.deepEqual(f.room.publicSnapshot(),next);
 let reads=0;const r=new ScheduledTournamentRoom(config(),{now:()=>{reads++;return T+59999+reads;},turnMs:1000});r.seat('a',1);r.seat('b',6);r.connect('a');r.connect('b');const before=reads,s=r.startHand(6);assert.equal(reads,before+1);assert.equal(s.turn.expiresAt,s.serverNow+1000);assert.equal(s.hand.terms.level,s.clock.level);
});

test('default result pause lasts eight seconds, including restored legacy default rooms',()=>{
 const f=setup();f.room.startHand(6);fold(f);
 const checkpoint=f.room.checkpoint();assert.equal(checkpoint.handPauseMs,8000);
 const control={enabled:true,published:true,members:['m1','m6'],expectedCount:2};
 f.setNow(7999);assert.equal(f.room.advance(control).event,'pause');
 f.setNow(8000);assert.equal(f.room.advance(control).event,'next-hand');
 checkpoint.handPauseMs=4000;
 const restored=ScheduledTournamentRoom.restore(checkpoint,{now:()=>T+7999});
 assert.equal(restored.advance(control).event,'pause');
 checkpoint.handPauseMs=25;
 assert.equal(ScheduledTournamentRoom.restore(checkpoint,{now:()=>T}).checkpoint().handPauseMs,25);
});

test('time bank extends only current player, replays once, survives restore and resets next hand',()=>{
 const f=setup();f.room.startHand(6);let s=f.room.publicSnapshot(),n=Number(s.hand.toAct.slice(5)),other=n===1?6:1;
 assert.throws(()=>f.room.timeBank('m'+other,f.tokens[other],s.hand.handId,s.hand.revision));
 assert.throws(()=>f.room.timeBank('m'+n,'obsolete',s.hand.handId,s.hand.revision));
 const before=s.turn.expiresAt,command={...s.turn};
 const used=f.room.timeBank('m'+n,f.tokens[n],s.hand.handId,s.hand.revision);assert.equal(used.replayed,false);assert.equal(used.state.turn.expiresAt,before+300000);assert.equal(used.state.timeBank.remaining,0);
 assert.equal(f.room.timeBank('m'+n,f.tokens[n],s.hand.handId,s.hand.revision).replayed,true);assert.equal(f.room.publicSnapshot().turn.expiresAt,before+300000);
 const restored=ScheduledTournamentRoom.restore(f.room.checkpoint(),{now:()=>T});const connected=restored.connect('m'+n);assert.equal(connected.state.timeBank.remaining,0);assert.equal(connected.state.turn.expiresAt,before+300000);
 f.setNow(before-T);assert.equal(f.room.expireTurn(command).expired,false);
 fold(f);s=f.room.publicSnapshot();f.room.nextHand(s.hand.handId);assert.equal(f.room.snapshot('m'+n,f.tokens[n]).timeBank.remaining,1);
});
test('time bank is rejected at exact deadline without changing chips or turn deadline',()=>{
 const f=setup();f.room.startHand(6);const s=f.room.publicSnapshot(),n=Number(s.hand.toAct.slice(5));f.setNow(s.turn.expiresAt-T);
 assert.throws(()=>f.room.timeBank('m'+n,f.tokens[n],s.hand.handId,s.hand.revision));assert.equal(f.room.publicSnapshot().turn.expiresAt,s.turn.expiresAt);assert.equal(chips(f.room.publicSnapshot()),20000);
});

test('targeted tournament opens exactly ten minutes before and starts only seated members at start',()=>{
 let now=T-600001;const room=new ScheduledTournamentRoom(config(),{now:()=>now}),control={enabled:true,published:true,members:['A','B','C'],expectedCount:3,seatedStart:true};assert.equal(room.advance(control).event,'scheduled');assert.throws(()=>room.join('A',true),/Seating not open/);
 now=T-600000;room.join('A',true);room.join('B',true);assert.equal(room.advance(control).event,'scheduled');assert.equal(room.publicSnapshot().hand,null);
 now=T;assert.equal(room.advance(control).event,'started');assert.equal(room.publicSnapshot().hand.players.length,2);assert.equal(room.publicSnapshot().seats.filter(s=>s.occupied).length,2);assert.throws(()=>room.join('C',true),/New seating unavailable/);assert.ok(room.join('A',true).connectionId);
 const restored=ScheduledTournamentRoom.restore(room.checkpoint(),{now:()=>now});assert.equal(restored.checkpoint().seatedStart,true);assert.throws(()=>restored.join('C',true));
});
test('fewer than two seated members never auto-win and late initial seating is rejected',()=>{let now=T-1000;const room=new ScheduledTournamentRoom(config(),{now:()=>now}),control={enabled:true,published:true,members:['A','B'],expectedCount:2,seatedStart:true};room.advance(control);room.join('A',true);now=T;assert.equal(room.advance(control).event,'insufficient-seated');assert.equal(room.publicSnapshot().hand,null);assert.throws(()=>room.join('B',true));});
test('checked-in disconnected player remains; cancelled member is excluded',()=>{let now=T-1000;const room=new ScheduledTournamentRoom(config(),{now:()=>now}),control={enabled:true,published:true,members:['A','B','C'],expectedCount:3,seatedStart:true};room.advance(control);const a=room.join('A',true);room.join('B',true);room.join('C',true);room.disconnect('A',a.connectionId);now=T;assert.equal(room.advance({...control,members:['A','B']}).event,'started');assert.equal(room.publicSnapshot().hand.players.length,2);assert.equal(room.publicSnapshot().seats.filter(s=>s.occupied).length,2);});

test('tournament time bank cards: default 2 cards, one card per turn adds one turn of time, restored intact',()=>{
 const f=setup();f.room.startHand(6);let s=f.room.publicSnapshot(),n=Number(s.hand.toAct.slice(5));
 const view=()=>f.room.snapshot('m'+n,f.tokens[n]).timeBank;
 assert.deepEqual(view(),{seconds:300,remaining:1,cards:2});
 const before=s.turn.expiresAt;f.room.timeBank('m'+n,f.tokens[n],s.hand.handId,s.hand.revision);
 assert.equal(f.room.publicSnapshot().turn.expiresAt,before+300000);assert.deepEqual(view(),{seconds:300,remaining:0,cards:1});
 const restored=ScheduledTournamentRoom.restore(f.room.checkpoint(),{now:()=>T});assert.equal(restored.connect('m'+n).state.timeBank.cards,1);
});
test('tournament settings choose 20s or 30s turns, 1-5 cards and optional final table cards',()=>{
 const {validateStructure,defaultStructure}=require('../lib/poker/tournament.ts');
 assert.equal(validateStructure({...defaultStructure,turnSeconds:30,timeBankCards:5,finalTableCards:2}).turnSeconds,30);
 assert.throws(()=>validateStructure({...defaultStructure,turnSeconds:25}));assert.throws(()=>validateStructure({...defaultStructure,timeBankCards:0}));assert.throws(()=>validateStructure({...defaultStructure,timeBankCards:6}));assert.throws(()=>validateStructure({...defaultStructure,finalTableCards:6}));
 assert.equal(validateStructure(defaultStructure).turnSeconds,undefined,'old tournaments keep their saved shape');
 // Two players already fit a final table, so the final-table cards are added at the start: 3 + 2.
 let now=T;const room=new ScheduledTournamentRoom({...config(),structure:{...config().structure,turnSeconds:30,timeBankCards:3,finalTableCards:2}},{now:()=>now});
 const tokens={};for(const n of [1,6]){room.seat('m'+n,n);tokens[n]=room.connect('m'+n).connectionId;}room.startHand(6);
 const st=room.publicSnapshot(),n=Number(st.hand.toAct.slice(5));assert.equal(st.turn.expiresAt-T,30000);
 assert.deepEqual(room.snapshot('m'+n,tokens[n]).timeBank,{seconds:30,remaining:1,cards:5});
});

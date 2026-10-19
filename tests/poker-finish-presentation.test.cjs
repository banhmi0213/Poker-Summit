const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {ScheduledTournamentRoom}=require('../lib/poker/scheduled-tournament-room.ts'),{resultPresentation}=require('../lib/poker/result-presentation.ts');
const T=Date.parse('2026-10-20T00:00:00Z');
function fixture(){let now=T;const r=new ScheduledTournamentRoom({starts_at:new Date(T).toISOString(),structure:{startingStack:1000,anteType:'none',lateRegLevel:1,reentry:false,periods:[{kind:'level',minutes:1,sb:50,bb:100,ante:0,note:''},{kind:'level',minutes:1,sb:100,bb:200,ante:0,note:''}]}},{now:()=>now});const tokens={};for(const n of [1,6]){r.seat('m'+n,n);tokens[n]=r.connect('m'+n).connectionId;}r.startHand(6);return {r,tokens,set:n=>now=n};}
function finish(f,from=0){while(f.r.publicSnapshot().hand.board.length<from){const s=f.r.publicSnapshot(),n=Number(s.hand.toAct.slice(5)),l=f.r.snapshot('m'+n,f.tokens[n]).hand.legal;f.r.act('m'+n,f.tokens[n],{handId:s.hand.handId,revision:s.hand.revision,actionId:crypto.randomUUID(),action:{type:l.check?'check':'call'}});}
 for(let i=0;i<8&&!f.r.publicSnapshot().hand.result;i++){const s=f.r.publicSnapshot(),n=Number(s.hand.toAct.slice(5)),l=f.r.snapshot('m'+n,f.tokens[n]).hand.legal;f.r.act('m'+n,f.tokens[n],{handId:s.hand.handId,revision:s.hand.revision,actionId:crypto.randomUUID(),action:l.raise?{type:l.check?'bet':'raise',amount:l.maxRaiseTo}:{type:'call'}});}return f.r.publicSnapshot();}
test('all-in runout presents streets in order, then awards, without changing authoritative chips',()=>{
 for(const from of [0,3,4]){const f=fixture(),s=finish(f,from),raw=JSON.stringify(s),counts=[from,...[3,4,5].filter(n=>n>from)];assert.equal(s.runout.fromBoardCount,from);
  for(let i=0;i<counts.length;i++){const frame=resultPresentation(s,T+i*1200);assert.equal(frame.revealing,true);assert.equal(frame.state.hand.board.length,counts[i]);assert.equal(frame.state.hand.result,null);assert.equal(frame.state.hand.players.reduce((n,p)=>n+p.stack,0)+frame.state.hand.pot,2000);}
  const award=resultPresentation(s,T+counts.length*1200);assert.equal(award.collecting,true);assert.deepEqual(award.state,s);assert.equal(JSON.stringify(s),raw);assert.equal(resultPresentation(s,T+9000).collecting,false);
  const restored=ScheduledTournamentRoom.restore(f.r.checkpoint(),{now:()=>T+1300});assert.deepEqual(restored.publicSnapshot().runout,s.runout);assert.equal(resultPresentation(restored.publicSnapshot()).state.hand.board.length,counts[1]);
 }
});
test('champion clock freezes; exact ten-minute deadline blocks reconnect while preserving final results',()=>{
 let f,s;for(let i=0;i<30;i++){f=fixture();s=finish(f);if(s.phase==='finished')break;}assert.equal(s.phase,'finished');const clock=s.clock,hand=s.hand;
 f.set(T+599999);assert.deepEqual(f.r.publicSnapshot().clock,clock);assert.equal(f.r.publicSnapshot().autoExitAt,T+600000);f.r.connect('m1');
 f.set(T+600000);assert.throws(()=>f.r.connect('m1'),/closed/);assert.throws(()=>f.r.join('m1',false),/closed/);assert.throws(()=>f.r.snapshot('m6',f.tokens[6]),/closed/);assert.deepEqual(f.r.publicSnapshot().hand,hand);
 const restored=ScheduledTournamentRoom.restore(f.r.checkpoint(),{now:()=>T+999999});assert.equal(restored.publicSnapshot().autoExitAt,T+600000);assert.deepEqual(restored.publicSnapshot().clock,clock);assert.throws(()=>restored.connect('m6'),/closed/);
});
test('joining an old result does not replay coin effects and ordinary active clocks still advance',()=>{
 const f=fixture(),s=finish(f);assert.equal(resultPresentation(s,T+600000).collecting,false);const active=fixture();active.set(T+61000);assert.equal(active.r.publicSnapshot().clock.level,2);assert.equal(active.r.publicSnapshot().autoExitAt,null);
});

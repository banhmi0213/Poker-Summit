const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),resolve=Module._resolveFilename;
Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {finishFoldedPracticeHand}=require('../app/poker-demo/finish-folded-hand.ts');
const {startForcedHand,ringTerms,carriedDemoStacks}=require('../lib/poker/tournament-hand.ts');
const {initialTournamentPositions}=require('../lib/poker/tournament-table.ts');
const {applyBettingAction,beginNextBettingStreet,legalBettingActions}=require('../lib/poker/betting.ts');
const {initialDeal:deal}=require('./helpers/poker-demo-browser-actions.ts');
const order=['you','p5','p3','p2','p4','p6'];
const passive=(r)=>{const L=legalBettingActions(r,r.toAct);return applyBettingAction(r,r.toAct,L.check?{type:'check'}:{type:'call'});};
test('skipping a folded practice hand conserves chips, records the exact fold loss, and advances real side pots',()=>{
 let count=0;
 for(let btn=0;btn<6;btn++)for(let street=0;street<4;street++)for(const calling of [true,false]){
  const pos=initialTournamentPositions(order,order,order[btn]);
  const stacks=order.map((id,i)=>({id,stack:2000+i*200}));
  let r=startForcedHand(stacks,0,ringTerms,pos).round;
  for(let s=0;s<street;s++){while(r.toAct)r=passive(r);r=beginNextBettingStreet(r,pos.postflopFirst);}
  while(r.toAct!=='you')r=passive(r);
  const folded=applyBettingAction(r,'you',{type:'fold'}),snapshot=JSON.stringify(folded);
  let seed=btn+17;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/2**32;
  const result=finishFoldedPracticeHand(folded,deal,order,pos.button,pos.bb,street,calling,rng);
  const carried=carriedDemoStacks(result.round,result.payouts);
  assert.equal(JSON.stringify(folded),snapshot,'input not mutated');
  assert.equal(result.round.toAct,null);assert.equal(result.payouts.you,0);
  assert.equal(carried.you,folded.players.find(p=>p.id==='you').stack,'no refund of folded investment');
  assert.equal(Object.values(carried).reduce((s,x)=>s+x,0),stacks.reduce((s,p)=>s+p.stack,0));
  assert(result.log.every(l=>l.id!=='you'));count++;
 }
 assert.equal(count,48);
});
test('unequal all-in contributions and folded money settle with the normal side-pot engine',()=>{
 const pos=initialTournamentPositions(order,order,'p6');
 let r=startForcedHand(order.map((id,i)=>({id,stack:id==='p3'?180:500+i*100})),0,ringTerms,pos).round;
 while(r.toAct!=='you'){const L=legalBettingActions(r,r.toAct);r=applyBettingAction(r,r.toAct,r.toAct==='p3'&&L.raise?{type:'raise',amount:L.maxRaiseTo}:L.check?{type:'check'}:{type:'call'});}
 r=applyBettingAction(r,'you',{type:'fold'});
 const result=finishFoldedPracticeHand(r,deal,order,pos.button,pos.bb,0,true);
 assert.equal(result.payouts.you,0);
 assert.equal(Object.values(result.payouts).reduce((s,x)=>s+x,0),result.round.players.reduce((s,p)=>s+p.totalCommitted,0));
 assert.equal(result.round.players.reduce((s,p)=>s+p.stack+(result.payouts[p.id]??0),0),r.players.reduce((s,p)=>s+p.stack+p.totalCommitted,0));
});

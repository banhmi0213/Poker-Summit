const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {HERO,TRAINER_STACK,TRAINER_SEATS,buttonIndexFor,startTrainerHand,trainerAct,trainerView,visibleBoard,netBB,gradeChoice}=require('../lib/poker/gto-trainer.ts');
const {legalBettingActions}=require('../lib/poker/betting.ts');
const {decideGto}=require('../lib/poker/gto-bot.ts');
const {trainerSpot}=require('../lib/poker/gto-review.ts');
const {loadGtoData}=require('../lib/poker/gto-data-node.ts');

function randomAction(h,id,r){
 const L=legalBettingActions(h.round,id),x=r();
 if(L.raise&&x<0.25){const lo=L.minRaiseTo,hi=L.maxRaiseTo,amt=x<0.05?hi:Math.min(hi,lo+Math.floor(r()*(hi-lo+1)));return {type:h.round.currentBet===0?'bet':'raise',amount:amt};}
 if(x<0.55)return L.check?{type:'check'}:{type:'call'};
 return L.check?{type:'check'}:{type:'fold'};
}

test('the hero moves one seat every hand and plays all six positions',()=>{
 const seen=[];for(let n=0;n<6;n++)seen.push(startTrainerHand(n+1,buttonIndexFor(n)).heroPos);
 assert.deepEqual(seen,['BTN','CO','HJ','UTG','BB','SB']);
});
test('same seed deals the same cards; cards are all different',()=>{
 const a=startTrainerHand(42,0),b=startTrainerHand(42,0);
 assert.deepEqual(a.holes,b.holes);assert.deepEqual(a.board,b.board);
 const all=[...Object.values(a.holes).flat(),...a.board].map(c=>c.rank+c.suit);assert.equal(new Set(all).size,17);
});
test('random hands always finish and keep every chip',()=>{
 let seed=1;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let k=0;k<400;k++){
  let h=startTrainerHand(k*7+3,buttonIndexFor(k));
  for(let guard=0;!h.result;guard++){assert.ok(guard<200);const id=h.round.toAct;assert.ok(id);assert.ok(trainerView(h,id));h=trainerAct(h,id,randomAction(h,id,r));}
  const total=h.round.players.reduce((s,p)=>s+p.stack+(h.result.payouts[p.id]??0),0);
  assert.equal(total,TRAINER_STACK*TRAINER_SEATS.length);
  assert.ok(Math.abs(TRAINER_SEATS.reduce((s,id)=>s+netBB(h,id),0))<0.5);
  assert.ok(h.result.winners.length>=1);
  if(h.result.showdown)assert.equal(visibleBoard(h).length,5);
 }
});
test('grading: most frequent is best, then by frequency',()=>{
 assert.equal(gradeChoice([0.7,0.3],0).level,'best');
 assert.equal(gradeChoice([0.7,0.3],1).level,'correct');
 assert.equal(gradeChoice([0.85,0.1,0.05],1).level,'inaccurate');
 assert.equal(gradeChoice([0.95,0.05],1).level,'mistake');
 assert.equal(gradeChoice([0.99,0.01],1).level,'blunder');
 assert.equal(gradeChoice([0.5,0.5],1).level,'best');
 assert.equal(gradeChoice([0.6,0.3],1).score,50);
});
test('GTO CPUs play full trainer hands and the hero menu covers the preflop decision',()=>{
 const data=loadGtoData();let graded=0;
 for(let k=0;k<12;k++){
  let h=startTrainerHand(1000+k,buttonIndexFor(k));
  for(let guard=0;!h.result&&guard<60;guard++){
   const id=h.round.toAct,v=trainerView(h,id);
   if(id===HERO&&h.street===0){const s=trainerSpot(v,data,300);if(s.source!=='none'){graded++;const sum=s.options.reduce((t,o)=>t+o.freq,0);assert.ok(Math.abs(sum-1)<1e-6);assert.ok(s.options.length>=2);assert.ok(s.options.every(o=>['fold','check','call','raise','bet','allin'].includes(o.kind)));}}
   const d=decideGto(v,data,Math.random,300);h=trainerAct(h,id,d.action);
  }
  assert.ok(h.result,'hand finished');
 }
 assert.ok(graded>=8,'most first preflop decisions are on the chart: '+graded);
});

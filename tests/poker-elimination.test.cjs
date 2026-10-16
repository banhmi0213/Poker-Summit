const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {initialTournamentPositions,nextTournamentPositions,finishTournamentHand}=require('../lib/poker/tournament-table.ts');
const {startForcedHand,ringTerms}=require('../lib/poker/tournament-hand.ts');
const {applyBettingAction,beginNextBettingStreet,legalBettingActions,potTotal}=require('../lib/poker/betting.ts');
const {settleCompletedHand}=require('../lib/poker/hand-settlement.ts');
const {settleShowdown}=require('../lib/poker/settlement.ts');
const {dealDemoHandAtTable}=require('../lib/poker/demo-deal.ts');
const order=['a','b','c','d','e','f'],initial=()=>initialTournamentPositions(order,order,'f');
const terms={...ringTerms,ante:25,anteType:'bb'};
test('SB elimination leaves a dead button, preserving next BB',()=>{
 const p=nextTournamentPositions(order,['b','c','d','e','f'],initial());
 assert.equal(p.button,'a');assert.equal(p.sb,'b');assert.equal(p.bb,'c');assert.equal(p.preflopFirst,'d');assert.equal(p.postflopFirst,'b');
});
test('BB elimination leaves a dead SB; following hand moves the dead button correctly',()=>{
 const live=['a','c','d','e','f'],p=nextTournamentPositions(order,live,initial());
 assert.equal(p.button,'a');assert.equal(p.sb,null);assert.equal(p.sbSeat,'b');assert.equal(p.bb,'c');assert.equal(p.postflopFirst,'c');
 const next=nextTournamentPositions(order,live,p);assert.equal(next.button,'b');assert.equal(next.sb,'c');assert.equal(next.bb,'d');
 const h=startForcedHand(live.map(id=>({id,stack:1000})),0,terms,p);
 assert.equal(potTotal(h.round),125);assert.equal(h.round.players.find(p=>p.id==='a').committed,0);assert.equal(h.round.players.find(p=>p.id==='c').committed,100);
});
test('consecutive vacant seats never skip a surviving players BB or charge a dead SB',()=>{
 const live=['a','b','e','f'];let p=initial();const big=[];
 for(let i=0;i<8;i++){p=nextTournamentPositions(order,live,p);big.push(p.bb);assert.ok(p.sb===null||live.includes(p.sb));}
 assert.deepEqual(big,['e','f','a','b','e','f','a','b']);
 const both=nextTournamentPositions(order,['c','d','e','f'],initial());assert.equal(both.sb,null);assert.equal(both.bb,'c');
});
test('three-to-two transition adjusts BTN/SB for each eliminated position and alternates',()=>{
 const previous=initialTournamentPositions(order,['a','b','c'],'c');
 for(const removed of ['a','b','c']){
  const live=['a','b','c'].filter(id=>id!==removed),p=nextTournamentPositions(order,live,previous);
  assert.ok(live.includes(p.button));assert.equal(p.button,p.sb);assert.notEqual(p.bb,p.sb);assert.equal(p.preflopFirst,p.button);assert.equal(p.postflopFirst,p.bb);
  if(live.includes(previous.bb))assert.notEqual(p.bb,previous.bb);
  const q=nextTournamentPositions(order,live,p);assert.equal(q.bb,p.button);assert.equal(q.button,p.bb);
 }
});
test('position validation rejects one player, duplicates, foreign seats and dead initial button',()=>{
 for(const live of [['a'],['a','a'],['a','foreign']])assert.throws(()=>initialTournamentPositions(order,live,'a'));
 assert.throws(()=>initialTournamentPositions(order,['a','b'],'f'));assert.throws(()=>nextTournamentPositions(order,['a','b'],{...initial(),bb:'foreign'}));
});
test('deal contains only survivors, uses clockwise order after live/dead button and unique cards',()=>{
 for(const [live,button,expected] of [[['a','c','e'],'b',['c','e','a']],[['a','d'],'a',['d','a']]]){
  const hand=dealDemoHandAtTable(order,live,button);assert.deepEqual(Object.keys(hand.holes),expected);assert.equal(hand.board.length,5);
  const cards=[...Object.values(hand.holes).flat(),...hand.board];assert.equal(new Set(cards.map(c=>`${c.rank}${c.suit}`)).size,cards.length);
 }
 assert.throws(()=>dealDemoHandAtTable(order,['a'],'f'));assert.throws(()=>dealDemoHandAtTable(order,['a','foreign'],'f'));
});
const card=(rank,suit)=>({rank,suit}),board=[card(10,'h'),card(11,'h'),card(12,'h'),card(13,'h'),card(14,'h')];
test('dead physical button remains valid at showdown and odd chips go to the next winner',()=>{
 const entries=[{id:'a',totalCommitted:1,folded:false,hole:[card(2,'c'),card(3,'d')]},{id:'c',totalCommitted:1,folded:false,hole:[card(4,'c'),card(5,'d')]},{id:'e',totalCommitted:1,folded:true,hole:[card(6,'c'),card(7,'d')]}];
 const r=settleShowdown(entries,board,order,'b');assert.deepEqual(r.payouts,{a:1,c:2,e:0});
});
function finished(entries){return {players:entries.map(p=>({id:p.id,stack:p.stack??0,totalCommitted:p.paid,committed:0,anteCommitted:p.ante??0,sharedAnte:p.ante??0,folded:false,allIn:!p.stack,acted:true})),currentBet:0,minRaise:100,bigBlind:100,toAct:null,lastAggressor:null};}
test('only post-award zero stacks are eliminated and returned pots keep a player alive',()=>{
 const r=finished([{id:'a',paid:100},{id:'b',paid:100},{id:'c',paid:100}]);
 const result=finishTournamentHand(r,{a:100,b:100,c:100},{a:150,b:150,c:0},'none');
 assert.deepEqual(result.liveIds,['a','b']);assert.deepEqual(result.eliminated.map(p=>[p.id,p.place]),[['c',3]]);assert.equal(result.champion,null);
 assert.throws(()=>finishTournamentHand(r,{a:100,b:100,c:100},{a:0,b:0,c:0},'none'),/conserved/);
});
test('simultaneous eliminations rank by starting stack, BBA subtracts ante only',()=>{
 const r=finished([{id:'a',paid:150},{id:'b',paid:200,ante:100},{id:'c',paid:300,stack:100}]),starting={a:150,b:200,c:400},payouts={a:0,b:0,c:650};
 const bba=finishTournamentHand(r,starting,payouts,'bb');assert.deepEqual(bba.eliminated.map(p=>[p.id,p.place,p.comparisonStack]),[['a',2,150],['b',3,100]]);assert.equal(bba.champion,'c');
 const regular=finishTournamentHand(r,starting,payouts,'none');assert.deepEqual(regular.eliminated.map(p=>[p.id,p.place]),[['b',2],['a',3]]);
});
test('equal comparison stacks retain tied place range, never invent a tie-breaker',()=>{
 const r=finished([{id:'a',paid:100},{id:'b',paid:200,ante:100},{id:'c',paid:300,stack:100}]);
 const result=finishTournamentHand(r,{a:100,b:200,c:400},{a:0,b:0,c:600},'bb');
 assert.deepEqual(result.eliminated.map(p=>[p.place,p.tiedThrough]),[[2,3],[2,3]]);assert.equal(result.champion,'c');
});
test('elimination history is idempotent and retained through later hands',()=>{
 const r=finished([{id:'a',paid:100},{id:'b',paid:100},{id:'c',paid:100}]);
 const result=finishTournamentHand(r,{a:100,b:100,c:100},{a:150,b:150,c:0},'none');
 assert.deepEqual(finishTournamentHand(r,{a:100,b:100,c:100},{a:150,b:150,c:0},'none',result.eliminated),result);
 const last=finished([{id:'a',paid:150},{id:'b',paid:150}]);const final=finishTournamentHand(last,{a:150,b:150},{a:300,b:0},'none',result.eliminated);
 assert.equal(final.champion,'a');assert.deepEqual(final.eliminated.map(p=>[p.id,p.place]),[['b',2],['c',3]]);assert.equal(final.stacks.c,0);
});
test('accounting rejects pending action, tampered payouts, duplicate history and re-entry',()=>{
 const r=finished([{id:'a',paid:100},{id:'b',paid:100}]),starting={a:100,b:100};
 assert.throws(()=>finishTournamentHand({...r,toAct:'a'},starting,{a:200,b:0},'none'));
 assert.throws(()=>finishTournamentHand(r,starting,{a:201,b:0},'none'));
 assert.throws(()=>finishTournamentHand(r,starting,{a:200,b:0,foreign:0},'none'));
 assert.throws(()=>finishTournamentHand(r,starting,{a:200,b:0},'none',[{id:'a',place:2}]));
});
test('completed six-seat tournaments conserve chips and finish with one champion without refills',()=>{
 let seed=8121;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const shuffleModule=require('../lib/poker/server-shuffle.ts'),oldShuffle=shuffleModule.shuffleDeck;
 shuffleModule.shuffleDeck=deck=>{const shuffled=[...deck];for(let i=shuffled.length-1;i>0;i--){const j=rand(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}return shuffled;};
 try {for(let run=0;run<40;run++){
  let live=[...order],stacks=Object.fromEntries(order.map(id=>[id,500])),pos=initial(),eliminated=[],champion=null;
  for(let hand=0;live.length>1;hand++){
   assert.ok(hand<100);const anteType=['none','bb','per-player'][run%3],limit=50+hand*20;
   const configured={level:1,index:0,sb:Math.ceil(limit/2),bb:limit,ante:anteType==='none'?0:limit,anteType};
   const starting=Object.fromEntries(live.map(id=>[id,stacks[id]]));let r=startForcedHand(live.map(id=>({id,stack:stacks[id]})),0,configured,pos).round;
   const deal=dealDemoHandAtTable(order,live,pos.button);
   let result;
   for(let street=0;street<4;street++){
    for(let action=0;r.toAct!==null;action++){
     assert.ok(action<100);const legal=legalBettingActions(r,r.toAct);
     const bet=legal.raise&&rand(3)===0?{type:r.currentBet?'raise':'bet',amount:legal.maxRaiseTo}:{type:legal.call?'call':'check'};
     r=applyBettingAction(r,r.toAct,bet);
    }
    result=settleCompletedHand(r,deal.board,deal.holes,order,pos.button,street===3);if(result)break;
    const offset=order.indexOf(pos.postflopFirst),first=[...order.slice(offset),...order.slice(0,offset)].find(id=>r.players.some(p=>p.id===id&&!p.folded&&!p.allIn));r=beginNextBettingStreet(r,first);
   }
   assert.ok(result);const outcome=finishTournamentHand(r,starting,result.payouts,anteType,eliminated);
   assert.equal(Object.values(outcome.stacks).reduce((a,b)=>a+b,0),3000);assert.equal(new Set(outcome.eliminated.map(e=>e.id)).size,outcome.eliminated.length);
   live=outcome.liveIds;stacks=outcome.stacks;eliminated=outcome.eliminated;champion=outcome.champion;
   if(live.length>1)pos=nextTournamentPositions(order,live,pos);
  }
  assert.equal(eliminated.length,5);assert.equal(stacks[champion],3000);assert.ok(!eliminated.some(e=>e.id===champion));
 }} finally {shuffleModule.shuffleDeck=oldShuffle;}
});

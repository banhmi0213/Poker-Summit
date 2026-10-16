const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {startForcedHand,tournamentHandTerms,carriedDemoStacks,ringTerms}=require('../lib/poker/tournament-hand.ts');
const {applyBettingAction,beginNextBettingStreet,calculateSidePots,potTotal,legalBettingActions,createBettingRound}=require('../lib/poker/betting.ts');
const {settleCompletedHand}=require('../lib/poker/hand-settlement.ts');
const {defaultStructure}=require('../lib/poker/tournament.ts');
const entries=(stacks=[1000,1000,1000])=>stacks.map((stack,i)=>({id:['a','b','c','d','e','f'][i],stack}));
const terms=(patch={})=>({...ringTerms,level:1,...patch});
const total=r=>r.players.reduce((n,p)=>n+p.stack+p.totalCommitted,0);
const close=round=>{let r=round;for(let n=0;r.toAct!==null;n++){assert.ok(n<50);const legal=legalBettingActions(r,r.toAct);r=applyBettingAction(r,r.toAct,{type:legal.call?'call':'check'});}return r;};
const c=(rank,suit)=>({rank,suit}),board=[c(2,'c'),c(7,'d'),c(9,'h'),c(11,'s'),c(12,'c')];
const holes={a:[c(14,'h'),c(14,'d')],b:[c(13,'h'),c(13,'d')],c:[c(3,'h'),c(4,'d')],d:[c(5,'h'),c(6,'d')],e:[c(8,'h'),c(8,'d')],f:[c(10,'h'),c(10,'d')]};
test('BBA is paid by BB only and is not a call or raise credit',()=>{
 const {round:r,antePaid}=startForcedHand(entries(),2,terms({ante:100,anteType:'bb'}));
 assert.deepEqual(antePaid,{a:0,b:100,c:0});assert.equal(potTotal(r),250);assert.equal(total(r),3000);
 const bb=r.players.find(p=>p.id==='b');assert.equal(bb.committed,100);assert.equal(bb.totalCommitted,200);assert.equal(bb.stack,800);assert.equal(r.currentBet,100);assert.equal(legalBettingActions(r,'c').callAmount,100);assert.equal(legalBettingActions(r,'c').minRaiseTo,200);
});
test('BBA short stack pays BB first, then remaining ante, never negative',()=>{
 for(const [stack,blind,ante] of [[40,40,0],[100,100,0],[140,100,40],[200,100,100]]){
  const {round:r,antePaid}=startForcedHand(entries([1000,stack,1000]),2,terms({ante:100,anteType:'bb'}));const b=r.players[1];
  assert.equal(b.committed,blind);assert.equal(antePaid.b,ante);assert.equal(b.stack,0);assert.equal(b.allIn,true);assert.equal(r.currentBet,100);assert.equal(total(r),2000+stack);
 }
});
test('a short blind retains full nominal preflop bring-in and minimum raise',()=>{
 const {round:r}=startForcedHand(entries([1000,30,1000]),2,terms());
 assert.equal(r.currentBet,100);assert.equal(legalBettingActions(r,'c').callAmount,100);assert.equal(legalBettingActions(r,'c').minRaiseTo,200);
});
test('all-player ante is paid before blinds; partial ante creates an all-in with no live bet',()=>{
 const {round:r,antePaid}=startForcedHand(entries([10,1000,1000]),2,terms({ante:25,anteType:'per-player'}));
 assert.deepEqual(antePaid,{a:10,b:25,c:25});assert.equal(r.players[0].committed,0);assert.equal(r.players[0].totalCommitted,10);assert.equal(r.players[0].allIn,true);assert.equal(r.players[1].committed,100);assert.equal(r.players[1].stack,875);assert.equal(potTotal(r),160);assert.equal(total(r),2010);
});
test('BBA common money is all in the main pot, not an artificial BB-only side pot',()=>{
 let r=startForcedHand(entries(),2,terms({ante:100,anteType:'bb'})).round;r=close(r);
 assert.deepEqual(calculateSidePots(r.players),[{amount:400,eligible:['a','b','c']}]);
 const result=settleCompletedHand(r,board,holes,['a','b','c'],'c',true);assert.deepEqual(result.payouts,{a:400,b:0,c:0});
 assert.equal(r.players.reduce((n,p)=>n+p.stack+result.payouts[p.id],0),3000);
});
test('short non-BB can win the entire BBA plus only matched wagers',()=>{
 let r=startForcedHand(entries([1000,1000,25]),2,terms({ante:100,anteType:'bb'})).round;r=close(r);
 assert.deepEqual(calculateSidePots(r.players),[{amount:175,eligible:['a','b','c']},{amount:150,eligible:['a','b']}]);
 const strongC={...holes,a:holes.c,c:holes.a};const result=settleCompletedHand(r,board,strongC,['a','b','c'],'c',true);
 assert.deepEqual(result.payouts,{a:0,b:150,c:175});assert.equal(r.players.reduce((n,p)=>n+p.stack+result.payouts[p.id],0),2025);
});
test('short BBA payer eligibility uses the live blind, not its ante contribution',()=>{
 let r=startForcedHand(entries([1000,150,1000]),2,terms({ante:100,anteType:'bb'})).round;r=close(r);
 assert.deepEqual(calculateSidePots(r.players),[{amount:350,eligible:['a','b','c']}]);
 const result=settleCompletedHand(r,board,holes,['a','b','c'],'c',false);assert.equal(result,null);
});
test('every-player partial ante cannot claim other players full antes or wagers',()=>{
 let r=startForcedHand(entries([10,1000,1000]),2,terms({ante:25,anteType:'per-player'})).round;r=close(r);
 assert.deepEqual(calculateSidePots(r.players),[{amount:30,eligible:['a','b','c']},{amount:230,eligible:['b','c']}]);
 const result=settleCompletedHand(r,board,holes,['a','b','c'],'c',true);assert.deepEqual(result.payouts,{a:30,b:230,c:0});
});
test('forced-bet all-ins can run out without an eligible actor',()=>{
 for(const anteType of ['bb','per-player']){
  const e=entries(anteType==='bb'?[10,20]:[10,20,5]), ids=e.map(p=>p.id), expected=e.reduce((n,p)=>n+p.stack,0);
  const r=startForcedHand(e,0,terms({ante:100,anteType})).round;
  assert.equal(r.toAct,null);assert.equal(total(r),expected);const result=settleCompletedHand(r,board,holes,ids,ids[0],false);
  assert.equal(result.showdown,true);assert.equal(Object.values(result.payouts).reduce((a,b)=>a+b,0),expected);
 }
 assert.throws(()=>createBettingRound(entries(),100,null),/Missing/);
});
test('ante survives street transitions exactly once and can never be checked as live credit',()=>{
 let r=startForcedHand(entries(),2,terms({ante:100,anteType:'bb'})).round;r=close(r);const pot=potTotal(r);
 r=beginNextBettingStreet(r,'a');assert.equal(potTotal(r),pot);assert.equal(r.players[1].anteCommitted,100);assert.equal(r.players[1].sharedAnte,100);assert.equal(r.currentBet,0);assert.equal(r.minRaise,100);assert.equal(total(r),3000);
});
test('fold winner gets both forced bets and ante with unchanged table total',()=>{
 let r=startForcedHand(entries(),2,terms({ante:100,anteType:'bb'})).round;
 while(r.toAct!==null)r=applyBettingAction(r,r.toAct,{type:'fold'});
 const result=settleCompletedHand(r,board,holes,['a','b','c'],'c',false);assert.equal(result.showdown,false);assert.equal(Object.values(result.payouts).reduce((a,b)=>a+b,0),250);assert.equal(r.players.reduce((n,p)=>n+p.stack+result.payouts[p.id],0),3000);
});
test('tied BBA main pot is split together with odd chip left of button',()=>{
 let r=close(startForcedHand(entries(),2,terms({ante:1,anteType:'bb'})).round);
 const tieBoard=[c(10,'h'),c(11,'h'),c(12,'h'),c(13,'h'),c(14,'h')];const tieHoles={a:[c(2,'c'),c(3,'d')],b:[c(4,'c'),c(5,'d')],c:[c(6,'c'),c(7,'d')]};const result=settleCompletedHand(r,tieBoard,tieHoles,['a','b','c'],'c',true);
 assert.deepEqual(result.payouts,{a:101,b:100,c:100});
});
test('unfinished resets refund all forced money while settled resets carry awards once',()=>{
 const r=close(startForcedHand(entries(),2,terms({ante:100,anteType:'bb'})).round);
 assert.deepEqual(carriedDemoStacks(r,null),{a:1000,b:1000,c:1000});
 const payouts=settleCompletedHand(r,board,holes,['a','b','c'],'c',true).payouts;
 assert.deepEqual(carriedDemoStacks(r,payouts),{a:1300,b:800,c:900});
 const next=startForcedHand(Object.entries(carriedDemoStacks(r,payouts)).map(([id,stack])=>({id,stack})),0,terms({bb:200,sb:100,ante:200,anteType:'bb'})).round;
 assert.equal(total(next),3000);assert.equal(potTotal(next),500);assert.equal(next.players[1].anteCommitted,0);assert.equal(next.players[2].anteCommitted,200);
});
test('new hand terms switch at exact boundary; existing snapshot does not change',()=>{
 const start='2026-10-16T10:00:00Z',t=Date.parse(start),tournament={starts_at:start,structure:structuredClone(defaultStructure)};
 assert.equal(tournamentHandTerms(tournament,t-1),null);
 const one=tournamentHandTerms(tournament,t+20*60000-1),two=tournamentHandTerms(tournament,t+20*60000);
 assert.equal(one.bb,100);assert.equal(two.bb,150);assert.equal(one.bb,100);
 const hand=startForcedHand(entries(),2,one);tournament.structure.periods[0].bb=999;assert.equal(hand.terms.bb,100);
 assert.equal(tournamentHandTerms(tournament,t+80*60000),null);assert.equal(tournamentHandTerms(tournament,t+90*60000).bb,400);assert.equal(tournamentHandTerms(tournament,t+999*60000).bb,1200);
});
test('invalid settings, zero starting seats and unsafe ante metadata are rejected',()=>{
 for(const patch of [{sb:0},{bb:1},{ante:-1},{ante:1.1},{anteType:'other'},{ante:1,anteType:'none'}])assert.throws(()=>startForcedHand(entries(),2,terms(patch)));
 assert.throws(()=>startForcedHand(entries([0,1000]),1,terms()));assert.throws(()=>startForcedHand([{id:'a',stack:Number.MAX_SAFE_INTEGER},{id:'b',stack:10}],0,terms()));
 assert.throws(()=>calculateSidePots([{id:'a',totalCommitted:10,sharedAnte:11,folded:false}]),/ante/);
 assert.throws(()=>createBettingRound([{id:'a',stack:10,committed:1,totalCommitted:2,anteCommitted:2},{id:'b',stack:10}],100,'b'),/ante/);
});

test('sole remaining player calls only a short blind and never folds unmatched excess',()=>{
 let r=startForcedHand(entries([1000,70]),0,terms()).round;
 assert.equal(r.currentBet,70);assert.equal(legalBettingActions(r,'a').callAmount,20);r=close(r);assert.equal(potTotal(r),140);
 const over=startForcedHand(entries([1000,30]),0,terms()).round;assert.equal(over.toAct,null);assert.equal(over.currentBet,50);
 const result=settleCompletedHand(over,board,holes,['a','b'],'a',false);assert.equal(result.showdown,true);assert.equal(Object.values(result.payouts).reduce((a,b)=>a+b,0),80);
});
test('seeded multi-street simulations preserve every chip across ante types and short stacks',()=>{
 let seed=72831;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let run=0;run<300;run++){
  const n=2+rand(5),e=entries(Array.from({length:n},()=>1+rand(1000))),ids=e.map(p=>p.id),button=rand(n),anteType=['none','bb','per-player'][run%3];
  const original=e.reduce((sum,p)=>sum+p.stack,0);let r=startForcedHand(e,button,terms({sb:10,bb:20,ante:anteType==='none'?0:25,anteType})).round;
  let result=null;
  for(let street=0;street<4;street++){
   for(let actions=0;r.toAct!==null;actions++){
    assert.ok(actions<100);const legal=legalBettingActions(r,r.toAct),draw=rand(10);
    const action=draw===0?{type:'fold'}:draw===1&&legal.raise?{type:r.currentBet?'raise':'bet',amount:legal.maxRaiseTo}:{type:legal.call?'call':'check'};
    r=applyBettingAction(r,r.toAct,action);assert.equal(total(r),original);
   }
   result=settleCompletedHand(r,board,holes,ids,ids[button],street===3);if(result)break;
   const start=(button+1)%n,first=[...ids.slice(start),...ids.slice(0,start)].find(id=>r.players.some(p=>p.id===id&&!p.allIn&&!p.folded));r=beginNextBettingStreet(r,first);
  }
  assert.ok(result);assert.equal(r.players.reduce((sum,p)=>sum+p.stack+result.payouts[p.id],0),original);assert.ok(Object.values(result.payouts).every(v=>Number.isSafeInteger(v)&&v>=0));
 }
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),{randomUUID}=require('crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts');
const {buildHandHistory}=require('../lib/poker/hand-history.ts');
const terms={level:0,index:0,sb:50,bb:100,ante:0,anteType:'none'};
const members=Object.fromEntries([1,2,3,4,5,6].map(n=>['seat-'+n,randomUUID()]));
const act=(hand,action)=>{const s=hand.snapshot(null);return hand.act(s.toAct,{handId:s.handId,revision:s.revision,actionId:randomUUID(),action});};

test('three-handed hand records forced bets, every action, positions and private cards',()=>{
 const hand=new AuthoritativeHand([{id:'seat-1',stack:1000},{id:'seat-3',stack:1000},{id:'seat-5',stack:1000}],0,terms);
 act(hand,{type:'raise',amount:300}); // BTN opens to 300
 act(hand,{type:'fold'});             // SB folds
 act(hand,{type:'call'});             // BB calls
 act(hand,{type:'check'});act(hand,{type:'bet',amount:200});act(hand,{type:'fold'});
 const h=buildHandHistory(hand.checkpoint(),members);
 assert.equal(h.handId,hand.snapshot(null).handId);
 assert.deepEqual(h.players.map(p=>[p.seatId,p.position]),[['seat-1','BTN'],['seat-3','SB'],['seat-5','BB']]);
 assert.deepEqual(h.actions.map(a=>[a.street,a.seatId,a.type,a.amount,a.to]),[
  ['preflop','seat-3','sb',50,50],['preflop','seat-5','bb',100,100],
  ['preflop','seat-1','raise',300,300],['preflop','seat-3','fold',0,50],['preflop','seat-5','call',200,300],
  ['flop','seat-5','check',0,0],['flop','seat-1','bet',200,200],['flop','seat-5','fold',0,0]]);
 assert.equal(h.actions.at(-2).pot,850);
 assert.deepEqual(h.players.map(p=>p.net),[350,-50,-300]);
 assert.equal(h.players.reduce((s,p)=>s+p.net,0),0);
 // Everyone's hole cards are kept for operators; nobody was shown because the hand ended without showdown.
 assert.ok(h.players.every(p=>p.hole.length===2&&p.shown===false));
 assert.equal(h.board.length,3);assert.equal(h.result.showdown,false);
 assert.equal(h.players[0].memberId,members['seat-1']);
});

test('all-in showdown marks only showdown players as shown and records the full board',()=>{
 const hand=new AuthoritativeHand([{id:'seat-2',stack:500},{id:'seat-4',stack:800}],0,terms);
 act(hand,{type:'raise',amount:500});act(hand,{type:'call'});
 const h=buildHandHistory(hand.checkpoint(),members);
 assert.deepEqual(h.players.map(p=>p.position),['BTN','BB']);
 assert.equal(h.board.length,5);assert.equal(h.result.showdown,true);
 assert.ok(h.players.every(p=>p.shown));
 assert.ok(h.actions.find(a=>a.type==='raise').allIn);
 assert.equal(h.players.reduce((s,p)=>s+p.net,0),0);
});

test('unsettled hands and unknown members are rejected',()=>{
 const hand=new AuthoritativeHand([{id:'seat-1',stack:1000},{id:'seat-2',stack:1000}],0,terms);
 assert.throws(()=>buildHandHistory(hand.checkpoint(),members),/not settled/);
 act(hand,{type:'fold'});
 assert.throws(()=>buildHandHistory(hand.checkpoint(),{'seat-1':randomUUID()}),/Missing history member/);
});

test('six-handed positions and per-player antes',()=>{
 const ids=[1,2,3,4,5,6].map(n=>'seat-'+n);
 const hand=new AuthoritativeHand(ids.map(id=>({id,stack:2000})),2,{level:1,index:1,sb:100,bb:200,ante:25,anteType:'per-player'});
 for(let i=0;i<5;i++)act(hand,{type:'fold'});
 const h=buildHandHistory(hand.checkpoint(),members);
 assert.deepEqual(h.players.map(p=>p.position),['HJ','CO','BTN','SB','BB','UTG']);
 assert.equal(h.actions.filter(a=>a.type==='ante').length,6);
 assert.equal(h.actions.filter(a=>a.type==='ante').every(a=>a.amount===25),true);
 assert.equal(h.players.reduce((s,p)=>s+p.net,0),0);
});

test('tendency flags: open, cold call, c-bet and fold to c-bet',()=>{
 const hand=new AuthoritativeHand([{id:'seat-1',stack:10000},{id:'seat-3',stack:10000},{id:'seat-5',stack:10000}],0,terms);
 act(hand,{type:'raise',amount:250});act(hand,{type:'fold'});act(hand,{type:'call'});
 act(hand,{type:'check'});act(hand,{type:'bet',amount:150});act(hand,{type:'fold'});
 const s=Object.fromEntries(buildHandHistory(hand.checkpoint(),members).players.map(p=>[p.position,p.stats]));
 assert.deepEqual([s.BTN.vpip,s.BTN.pfr,s.BTN.cbetOpp,s.BTN.cbet,s.BTN.sawFlop],[true,true,true,true,true]);
 assert.deepEqual([s.SB.vpip,s.SB.threeBetOpp,s.SB.threeBet,s.SB.sawFlop],[false,true,false,false]);
 assert.deepEqual([s.BB.vpip,s.BB.pfr,s.BB.threeBetOpp,s.BB.foldToCbetOpp,s.BB.foldToCbet,s.BB.cbetOpp],[true,false,true,true,true,false]);
 assert.ok(Object.values(s).every(v=>!v.wentToShowdown&&!v.foldTo3BetOpp));
});

test('tendency flags: 3-bet and fold to 3-bet; a second raise in front is not a 3-bet chance',()=>{
 const hand=new AuthoritativeHand([{id:'seat-1',stack:10000},{id:'seat-3',stack:10000},{id:'seat-5',stack:10000}],0,terms);
 act(hand,{type:'raise',amount:250});act(hand,{type:'raise',amount:900});act(hand,{type:'fold'});act(hand,{type:'fold'});
 const s=Object.fromEntries(buildHandHistory(hand.checkpoint(),members).players.map(p=>[p.position,p.stats]));
 assert.deepEqual([s.SB.threeBetOpp,s.SB.threeBet,s.SB.pfr],[true,true,true]);
 assert.deepEqual([s.BTN.foldTo3BetOpp,s.BTN.foldTo3Bet,s.BTN.threeBetOpp],[true,true,false]);
 assert.deepEqual([s.BB.threeBetOpp,s.BB.vpip],[false,false]);
});

test('tendency flags: limp and free big blind check are not counted alike; all-in showdown counts WTSD/W$SD',()=>{
 const limp=new AuthoritativeHand([{id:'seat-2',stack:10000},{id:'seat-4',stack:10000}],0,terms);
 act(limp,{type:'call'});while(!limp.snapshot(null).result)act(limp,{type:'check'});
 const l=buildHandHistory(limp.checkpoint(),members).players;
 assert.deepEqual(l.map(p=>[p.position,p.stats.vpip,p.stats.pfr,p.stats.cbetOpp,p.stats.wentToShowdown]),[['BTN',true,false,false,true],['BB',false,false,false,true]]);
 const allIn=new AuthoritativeHand([{id:'seat-2',stack:500},{id:'seat-4',stack:800}],0,terms);
 act(allIn,{type:'raise',amount:500});act(allIn,{type:'call'});
 const h=buildHandHistory(allIn.checkpoint(),members);
 assert.ok(h.players.every(p=>p.stats.sawFlop&&p.stats.wentToShowdown));
 for(const p of h.players)assert.equal(p.stats.wonAtShowdown,h.result.winners.includes(p.seatId));
});

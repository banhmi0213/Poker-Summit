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

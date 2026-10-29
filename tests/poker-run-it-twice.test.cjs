const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {AuthoritativeHand}=require('../lib/poker/authoritative-hand.ts');
const {settleShowdownRuns,settleShowdown}=require('../lib/poker/settlement.ts');
const {buildHandHistory}=require('../lib/poker/hand-history.ts');
const terms={level:0,index:0,sb:50,bb:100,ante:0,anteType:'none'};
const C=s=>({rank:'23456789TJQKA'.indexOf(s[0])+2,suit:s[1]});
let n=0;const act=(h,seat,action)=>{const s=h.snapshot(seat);return h.act(seat,{handId:s.handId,revision:s.revision,actionId:'a'+(++n),action});};
/** Heads-up (or n-way) everyone all-in preflop. */
function allInPreflop(stacks,{runItTwice=true,fold=[]}={}){
 const entries=stacks.map((stack,i)=>({id:'seat-'+(i+1),stack}));
 const h=new AuthoritativeHand(entries,0,terms,undefined,undefined,{runItTwice});
 for(let guard=0;guard<12;guard++){const s=h.snapshot(null);if(!s.toAct)break;const me=h.snapshot(s.toAct),l=me.legal;
  if(fold.includes(s.toAct)&&l.fold)act(h,s.toAct,{type:'fold'});else if(l.raise)act(h,s.toAct,{type:'raise',amount:l.maxRaiseTo});else act(h,s.toAct,{type:'call'});}
 return h;
}
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);

test('pot split across two runs: every chip lands, side pots split separately, odd chip to the first run',()=>{
 const holes={a:[C('Ah'),C('Ad')],b:[C('Kh'),C('Kd')],c:[C('2c'),C('7d')]};
 const e=[{id:'a',totalCommitted:301,folded:false,hole:holes.a},{id:'b',totalCommitted:501,folded:false,hole:holes.b},{id:'c',totalCommitted:501,folded:false,hole:holes.c}];
 const boardA=[C('Ac'),C('9s'),C('5h'),C('3d'),C('Js')],boardK=[C('Kc'),C('9h'),C('5s'),C('3c'),C('Jd')];
 const r=settleShowdownRuns(e,[boardA,boardK],['a','b','c'],'a');
 assert.equal(sum(r.payouts),1303);
 // main pot 903 -> run1 452 (a wins), run2 451 (b wins); side pot 400 (b,c) -> b both runs
 assert.deepEqual(r.payouts,{a:452,b:451+400,c:0});
 assert.deepEqual(r.runWinners,[['a','b'],['b']]);
 const once=settleShowdownRuns(e,[boardA],['a','b','c'],'a'),plain=settleShowdown(e,boardA,['a','b','c'],'a');
 assert.deepEqual(once.payouts,plain.payouts,'one run equals the normal showdown');
 assert.throws(()=>settleShowdownRuns(e,[boardA,[C('Ah'),C('2d'),C('3s'),C('4s'),C('5s')]],['a','b','c'],'a'),/overlaps/);
});

test('ring all-in waits for the choice with cards face up; both choosing 2 runs it twice',()=>{
 const h=allInPreflop([1000,1000]);let s=h.snapshot(null);
 assert.equal(s.result,null);assert.equal(s.toAct,null);assert.deepEqual(s.runs.participants,['seat-1','seat-2']);assert.equal(s.runs.decided,null);
 assert.ok(s.players.every(p=>p.hole&&p.hole.length===2),'spectators see both hands at the all-in');
 assert.equal(h.snapshot('seat-1').runs.canChoose,true);
 assert.throws(()=>act(h,'seat-1',{type:'check'}),/Waiting for run choice/);
 act(h,'seat-1',{type:'runs',count:2});
 assert.throws(()=>act(h,'seat-1',{type:'runs',count:2}),/Not your run choice/);
 assert.equal(h.snapshot('seat-1').runs.canChoose,false);assert.equal(h.snapshot(null).result,null);
 act(h,'seat-2',{type:'runs',count:2});
 s=h.snapshot(null);
 assert.ok(s.result.showdown);assert.equal(s.result.boards.length,2);assert.equal(s.runs.decided,2);
 assert.deepEqual(s.result.boards[0],s.board);
 const all=[...s.result.boards[0],...s.result.boards[1],...s.players.flatMap(p=>p.hole)].map(c=>c.rank+c.suit);
 assert.equal(new Set(all).size,all.length,'second run uses fresh cards');
 assert.equal(sum(Object.fromEntries(s.players.map(p=>[p.id,p.stack]))),2000,'chips conserved');
});

test('any single 1 (or the first answer being 1) settles once, exactly like a normal all-in',()=>{
 const h=allInPreflop([1000,1000]);act(h,'seat-2',{type:'runs',count:1});
 const s=h.snapshot(null);assert.ok(s.result.showdown);assert.equal(s.result.boards,undefined);assert.equal(s.runs.decided,1);
 const cp=h.checkpoint(),plain=AuthoritativeHand.restore({...cp,deal:{board:cp.deal.board,holes:cp.deal.holes},commands:cp.commands.filter(c=>c.command.action.type!=='runs')}).snapshot(null);
 assert.deepEqual(s.result.payouts,plain.result.payouts);
});

test('tournaments (no option) settle all-ins immediately; folded players are not asked',()=>{
 const t=allInPreflop([1000,1000],{runItTwice:false});assert.ok(t.snapshot(null).result.showdown);assert.equal(t.snapshot(null).runs,undefined);
 const h=allInPreflop([1000,1000,1000],{fold:['seat-1']});const s=h.snapshot(null);
 assert.equal(s.runs.participants.length,2);assert.ok(!s.runs.participants.includes('seat-1'));
 assert.equal(s.players.find(p=>p.id==='seat-1').hole,null,'folded hand stays hidden');
 assert.throws(()=>act(h,'seat-1',{type:'runs',count:2}),/Not your run choice/);
});

test('flop all-in keeps the flop on the second run; checkpoint replay and hand history agree',()=>{
 const entries=[{id:'seat-1',stack:1000},{id:'seat-2',stack:1000}];
 const h=new AuthoritativeHand(entries,0,terms,undefined,undefined,{runItTwice:true});
 act(h,h.snapshot(null).toAct,{type:'call'});act(h,h.snapshot(null).toAct,{type:'check'});
 assert.equal(h.snapshot(null).board.length,3);
 const first=h.snapshot(null).toAct,l=h.snapshot(first).legal;act(h,first,{type:'bet',amount:l.maxRaiseTo});act(h,h.snapshot(null).toAct,{type:'call'});
 assert.equal(h.snapshot(null).runs.from,3);
 act(h,'seat-1',{type:'runs',count:2});act(h,'seat-2',{type:'runs',count:2});
 const s=h.snapshot(null);assert.deepEqual(s.result.boards[1].slice(0,3),s.result.boards[0].slice(0,3));
 assert.notDeepEqual(s.result.boards[1].slice(3),s.result.boards[0].slice(3));
 const again=AuthoritativeHand.restore(h.checkpoint()).snapshot(null);assert.deepEqual(again.result,s.result);
 const hist=buildHandHistory(h.checkpoint(),{'seat-1':'00000000-0000-4000-8000-000000000001','seat-2':'00000000-0000-4000-8000-000000000002'});
 assert.equal(hist.result.runs.length,2);assert.ok(hist.actions.every(a=>a.type!=='runs'));
 assert.equal(sum(hist.result.payouts),2000);
});

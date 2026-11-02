const {test}=require('node:test'),assert=require('node:assert/strict');
require('../scripts/poker-gto/common.cjs');
const {PreflopSolver,setRealizeFit}=require('../lib/poker/preflop-solver.ts');
const equity=require('../data/poker-gto/preflop-equity.json');
const baseline=require('../data/poker-gto/preflop-play-fit.json');

test('a depth-specific fit is used without scaling and does not alter the 100BB model',()=>{
 try{
  setRealizeFit(baseline);
  const before=new PreflopSolver(equity,{stack:100,ante:0,seats:8});
  setRealizeFit({...baseline,byStack:{'40':{play:{'72o':0.6},role:{srp:{call:0.51,aggr:0.8,callBy:{BTN:0.43,UTG:0.62}}}}}});
  const fitted=new PreflopSolver(equity,{stack:40,ante:1,seats:8});
  assert.equal(fitted.play[fitted.labels.indexOf('72o')],0.6);
  assert.equal(fitted.depth,1);
  assert.equal(fitted.role.srp.callBy.BTN,0.43);
  const after=new PreflopSolver(equity,{stack:100,ante:0,seats:8});
  assert.deepEqual(after.play,before.play);
  assert.deepEqual(after.role,before.role);
 }finally{setRealizeFit(baseline);}
});

test('a BTN caller fit changes BB call EV versus BTN, leaving UTG and 3-bet pots unchanged',()=>{
 // A small real-equity subset keeps this an EV regression, without an expensive fit run.
 const labels=['AA','AKs','JTs','72o'],idx=labels.map(l=>equity.labels.indexOf(l));
 const subset={labels,eq:idx.map(i=>idx.map(j=>equity.eq[i][j]))};
 function values(btn){
  setRealizeFit({...baseline,byStack:{'40':{role:{srp:{call:0.55,aggr:0.8,callBy:{BTN:btn,UTG:0.55}}}}}});
  const s=new PreflopSolver(subset,{stack:40,ante:1,seats:8}),ev=s.actionEvs();
  const calls=(opener,kind,caller='BB')=>{
   const d=s.decisions.find(d=>s.names[d.player]===caller&&d.children.some(c=>c.type==='terminal'&&c.showdown?.kind===kind&&s.names[c.showdown.aggr]===opener)&&d.actions.some(a=>a.kind==='call'));
   assert.ok(d,`${opener} ${kind} ${caller} decision exists`);
   const a=d.actions.findIndex(a=>a.kind==='call');
   return labels.map((_,h)=>ev[d.id][h*d.actions.length+a]);
  };
  return {btn:calls('BTN','srp'),utg:calls('UTG','srp'),threeBet:calls('BB','3bp','BTN')};
 }
 try{
  const low=values(0.4),high=values(0.8);
  for(let h=0;h<labels.length;h++)assert.ok(high.btn[h]>low.btn[h],`${labels[h]} benefits from improved realisation`);
  assert.deepEqual(high.utg,low.utg);
  assert.deepEqual(high.threeBet,low.threeBet);
 }finally{setRealizeFit(baseline);}
});

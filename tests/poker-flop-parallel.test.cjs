const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('path');
require('../scripts/poker-gto/common.cjs');
const {PostflopSolver}=require('../lib/poker/postflop-solver.ts');
const {parallelize}=require('../scripts/poker-gto/parallel-flop.cjs');
test('a flop solve split over worker threads gives the same answer as one thread',()=>{
 const R='23456789TJQKA',S='cdhs',code=s=>R.indexOf(s[0])*4+S.indexOf(s[1]);
 const board=['Kh','7d','2c'].map(code),hands=l=>l.map(h=>({c1:code(h.slice(0,2)),c2:code(h.slice(2)),weight:1}));
 const spot={board,pot:20,stack:30,betSizes:[0.5],raiseSizes:[],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5,riverCurrentOnly:true,
  ranges:[hands(['AsKs','QsQd','9h8h','6c4c']),hands(['KdQd','AhJh','8s8c','Td9d'])]};
 const one=new PostflopSolver(spot).run(6),many=new PostflopSolver(spot),stop=parallelize(many,spot,3);
 try{many.run(6);
  const a=one.strategy(one.tree,true),b=many.strategy(many.tree,true);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<1e-9);
  assert.ok(Math.abs(one.exploitability()-many.exploitability())<1e-9);
  const ha=one.handValues(1),hb=many.handValues(1);for(let i=0;i<ha.length;i++)assert.ok(Math.abs(ha[i]-hb[i])<1e-9);
 }finally{stop();}
});

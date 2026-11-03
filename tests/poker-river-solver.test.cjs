const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {RiverSolver}=require('../lib/poker/river-solver.ts');
const code=s=>('23456789TJQKA'.indexOf(s[0]))*4+'cdhs'.indexOf(s[1]);
const combo=(s,w=1)=>({c1:code(s.slice(0,2)),c2:code(s.slice(2,4)),weight:w});
test('polarized river: value bets always, bluffs to 1/3 of the betting range, caller defends 50% vs a pot bet',()=>{
 const board=['As','Ks','Qs','7d','2c'].map(code);
 const solver=new RiverSolver({board,pot:1,stack:1,betSizes:[1],raiseSizes:[],maxRaises:0,
  ranges:[[combo('JsTs'),combo('4h3h'),combo('5h3d')],[combo('7h7c')]]}).run(3000);
 const root=solver.tree,s=solver.strategy(root,true),k=root.actions.length,bet=root.actions.findIndex(a=>a.to===1);
 const O=solver.sides[0],idx=x=>[...Array(O.n).keys()].find(i=>O.c1[i]===code(x.slice(0,2))&&O.c2[i]===code(x.slice(2,4)));
 assert.ok(s[idx('JsTs')*k+bet]>0.99,'nuts always bet');
 const bluff=s[idx('4h3h')*k+bet]+s[idx('5h3d')*k+bet];assert.ok(Math.abs(bluff-0.5)<0.05,'bluff weight '+bluff);
 const facing=root.children[bet],fs2=solver.strategy(facing,true),call=facing.actions.findIndex(a=>a.kind==='call');
 assert.ok(Math.abs(fs2[0*facing.actions.length+call]-0.5)<0.05,'call freq '+fs2[call]);
 assert.ok(solver.exploitability()<0.01,'exploitability '+solver.exploitability());
});
test('a realistic river converges with card removal and several sizes',()=>{
 const R='AKQJT98765432',S='cdhs',board=['Ah','Td','7c','4s','2h'].map(code),all=[];
 for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)all.push({c1:a,c2:b,weight:1});
 const top=(n)=>all.filter(c=>{const hi=Math.max(c.c1,c.c2)>>2,lo=Math.min(c.c1,c.c2)>>2;return hi+lo>=n;});
 const t0=Date.now();const solver=new RiverSolver({board,pot:10,stack:50,betSizes:[0.33,0.75],raiseSizes:[3],maxRaises:1,ranges:[top(14),top(16)]}).run(300);
 const ex=solver.exploitability();assert.ok(ex<0.02,'exploitability '+ex);assert.ok(Date.now()-t0<60000);
 const [v0,v1]=solver.values();assert.ok(Math.abs(v0+v1-10)<1e-6,'constant sum');
});

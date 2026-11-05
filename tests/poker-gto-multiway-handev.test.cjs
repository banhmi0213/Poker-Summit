const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {MultiwaySolver}=require('../lib/poker/multiway-solver.ts');

test('three-way handValues are finite per-combo values and aggregate to values()',()=>{
 const board=[48,45,0];
 const range=(base)=>Array.from({length:5},(_,i)=>({c1:base+i*2,c2:base+i*2+1,weight:0.5+i/10}));
 const solver=new MultiwaySolver({board,pot:8,stack:20,ranges:[range(2),range(14),range(26)],betSizes:[0.33],raiseSizes:[],maxRaises:0,depthLimit:true});
 solver.run(2);
 const avg=solver.values();
 for(const hero of [0,1,2]){
  const v=solver.handValues(hero),side=solver.sides[hero];
  assert.equal(v.length,side.n);assert.ok([...v].every(Number.isFinite));
  // Re-weighting by compatible opponent-pair reach must reproduce the solver's aggregate seat value.
  const opp=hero===0?[1,2]:hero===1?[0,2]:[0,1];
  const compatible=(h,p)=>{const H=side,O=solver.sides[p];let n=0;for(let o=0;o<O.n;o++)if(O.c1[o]!==H.c1[h]&&O.c1[o]!==H.c2[h]&&O.c2[o]!==H.c1[h]&&O.c2[o]!==H.c2[h])n+=O.w[o];return n;};
  let num=0,den=0;for(let h=0;h<side.n;h++){const w=side.w[h]*compatible(h,opp[0])*compatible(h,opp[1]);num+=w*v[h];den+=w;}
  assert.ok(Math.abs(num/den-avg[hero])<1e-9,`${hero}: ${num/den} vs ${avg[hero]}`);
 }
});

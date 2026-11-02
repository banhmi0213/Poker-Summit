const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),Module=require('module');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/npm-tools/node_modules/typescript');}
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const {POSITION_SLUGS,positionNode,actionTotals}=require('../lib/poker/preflop-positions.ts');

test('every position page finds its chart, and the chart covers all 169 hands',()=>{
 for(const s of POSITION_SLUGS){
  const n=positionNode(s);assert.ok(n,s);
  assert.equal(Object.keys(n.strategy).length,169,s);
  const t=actionTotals(n);assert.ok(Math.abs(t.reduce((a,b)=>a+b,0)-1)<1e-6,s);
  if(s==='bb')assert.equal(n.kind,'vsOpen');else assert.equal(n.kind,'open');
 }
 // Opening gets wider towards the button.
 const open=['utg','hj','co','btn'].map(s=>1-actionTotals(positionNode(s))[0]);
 for(let i=1;i<open.length;i++)assert.ok(open[i]>open[i-1]);
});

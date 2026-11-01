const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {tierCondition,tierAllowed,parseRingRank,tierName}=require('../lib/poker/ring-rank.ts');
test('rank names run from rookie to legend',()=>{assert.equal(tierName(0),'ルーキー');assert.equal(tierName(4),'プラチナ');assert.equal(tierName(6),'レジェンド');});
test('table conditions read naturally',()=>{assert.equal(tierCondition({min:0,max:6}),null);assert.equal(tierCondition({min:4,max:6}),'プラチナ以上');assert.equal(tierCondition({min:0,max:3}),'ゴールドまで');});
test('who may sit',()=>{assert.equal(tierAllowed(3,{min:0,max:3}),true);assert.equal(tierAllowed(4,{min:0,max:3}),false);assert.equal(tierAllowed(3,{min:4,max:6}),false);assert.equal(tierAllowed(null,{min:4,max:6}),true);});
test('rank replies are checked',()=>{assert.equal(parseRingRank({available:1000}),null);const r=parseRingRank({tier:2,bb:'150.5',hands:300,place:3,players:40,next:300,floor:100,rookieHandsLeft:0,baseChips:1000});assert.equal(r.bb,150.5);assert.equal(r.place,3);});

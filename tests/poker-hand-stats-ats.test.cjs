// ATS (owner 2026/10/30): a steal chance is the first preflop decision from CO / BTN / SB with only folds in front.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {handStats}=require('../lib/poker/hand-stats.ts');
const pre=(seatId,type)=>({street:'preflop',seatId,type,amount:0,to:0,allIn:false,pot:0});
const players=[['seat-1','UTG'],['seat-2','CO'],['seat-3','BTN'],['seat-4','SB'],['seat-5','BB']].map(([seatId,position])=>({seatId,position,net:0}));
const run=actions=>handStats({actions,players,board:[],result:{showdown:false,winners:['seat-5']}});
test('folded to the button: the button has a steal chance and takes it with a raise',()=>{
 const s=run([pre('seat-4','sb'),pre('seat-5','bb'),pre('seat-1','fold'),pre('seat-2','fold'),pre('seat-3','raise'),pre('seat-4','fold'),pre('seat-5','fold')]);
 assert.deepEqual([s['seat-2'].stealOpp,s['seat-2'].steal],[true,false],'CO folded its chance');
 assert.deepEqual([s['seat-3'].stealOpp,s['seat-3'].steal],[true,true]);
 assert.equal(s['seat-4'].stealOpp,false,'SB faces a raise: no steal chance');
 assert.equal(s['seat-1'].stealOpp,false,'UTG is not a steal seat');
 assert.equal(s['seat-5'].stealOpp,false,'BB is not a steal seat');
});
test('a limp in front removes the chance; a call is not a steal',()=>{
 let s=run([pre('seat-4','sb'),pre('seat-5','bb'),pre('seat-1','call'),pre('seat-2','raise')]);
 assert.equal(s['seat-2'].stealOpp,false);
 s=run([pre('seat-4','sb'),pre('seat-5','bb'),pre('seat-1','fold'),pre('seat-2','fold'),pre('seat-3','fold'),pre('seat-4','call')]);
 assert.deepEqual([s['seat-4'].stealOpp,s['seat-4'].steal],[true,false]);
});

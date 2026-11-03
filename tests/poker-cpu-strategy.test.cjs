const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript'),Module=require('module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,resolveJsonModule:true,esModuleInterop:true}}).outputText,f);
const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(__dirname,'..',r.slice(2)):r,...a);};
const {decideCpuAction,handPercentile,CPU_STYLES}=require('../lib/poker/cpu-strategy.ts');
const seeded=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const c=(rank,suit)=>({rank,suit});
const legal=(o={})=>({check:false,call:true,raise:true,minRaiseTo:200,maxRaiseTo:10000,...o});
const base=(o={})=>({hole:[c(14,'s'),c(14,'h')],board:[],pot:150,toCall:100,stack:10000,committed:0,currentBet:100,bigBlind:100,legal:legal(),opponents:5,playersBehind:5,isBigBlind:false,...o});
test('hand ranking puts premium hands first and 72o last',()=>{assert.ok(handPercentile([c(14,'s'),c(14,'h')])<0.01);assert.ok(handPercentile([c(3,'s'),c(2,'h')])>0.97);assert.ok(handPercentile([c(7,'s'),c(2,'h')])>0.9);});
test('preflop: opens premiums, folds trash early, defends the big blind wider',()=>{
 for(const st of Object.values(CPU_STYLES)){assert.equal(decideCpuAction(base(),st,seeded(1)).type,'raise');assert.equal(decideCpuAction(base({hole:[c(7,'s'),c(2,'h')]}),st,seeded(2)).type,'fold');}
 const open=decideCpuAction(base(),CPU_STYLES.standard,seeded(3));assert.equal(open.amount,250);
 const facing={currentBet:250,toCall:150,pot:400,playersBehind:0,isBigBlind:true,legal:legal({minRaiseTo:400})};
 assert.equal(decideCpuAction(base({...facing,hole:[c(9,'s'),c(8,'s')]}),CPU_STYLES.standard,seeded(4)).type,'call');
 assert.equal(decideCpuAction(base({...facing,hole:[c(7,'s'),c(2,'h')]}),CPU_STYLES.standard,seeded(5)).type,'fold');
});
test('free checks are never folded; illegal raises fall back to calls',()=>{
 const free=base({hole:[c(7,'s'),c(2,'h')],toCall:0,currentBet:100,legal:legal({check:true,call:false}),isBigBlind:true,playersBehind:0});
 assert.notEqual(decideCpuAction(free,CPU_STYLES.tight,seeded(6)).type,'fold');
 assert.equal(decideCpuAction(base({legal:legal({raise:false,minRaiseTo:null,maxRaiseTo:null})}),CPU_STYLES.standard,seeded(7)).type,'call');
});
test('postflop: bets the nuts, folds air to a big river bet, and every size is legal',()=>{
 const board=[c(13,'s'),c(12,'s'),c(11,'s'),c(2,'d'),c(3,'c')];
 const nuts={hole:[c(14,'s'),c(10,'s')],board,pot:1000,toCall:0,currentBet:0,legal:legal({check:true,call:false,minRaiseTo:100,maxRaiseTo:9000}),opponents:1};
 const a=decideCpuAction(base(nuts),CPU_STYLES.standard,seeded(8));assert.equal(a.type,'bet');assert.ok(a.amount>=100&&a.amount<=9000);
 const air={hole:[c(7,'h'),c(4,'d')],board,pot:1000,toCall:1000,currentBet:1000,legal:legal({minRaiseTo:2000}),opponents:1};
 assert.equal(decideCpuAction(base(air),CPU_STYLES.loose,seeded(9)).type,'fold');
});
test('short stacks play shove-or-fold from the push/fold chart',()=>{
 const short=(o={})=>base({stack:900,committed:0,maxOpponentStack:5000,playersBehind:2,legal:legal({minRaiseTo:200,maxRaiseTo:900}),...o});
 const shove=decideCpuAction(short(),CPU_STYLES.standard,seeded(10));assert.deepEqual(shove,{type:'raise',amount:900});
 assert.equal(decideCpuAction(short({hole:[c(7,'s'),c(2,'h')]}),CPU_STYLES.standard,seeded(11)).type,'fold');
 const facing={currentBet:900,toCall:800,pot:1050,opponents:1,playersBehind:0,isBigBlind:true,committed:100,stack:800,legal:legal({raise:false,minRaiseTo:null,maxRaiseTo:null})};
 assert.equal(decideCpuAction(short({...facing,hole:[c(9,'s'),c(9,'h')]}),CPU_STYLES.standard,seeded(12)).type,'call');
 assert.equal(decideCpuAction(short({...facing,hole:[c(7,'s'),c(2,'h')]}),CPU_STYLES.standard,seeded(13)).type,'fold');
 // Deep stacks are unaffected by the short-stack rule.
 assert.equal(decideCpuAction(base({maxOpponentStack:10000}),CPU_STYLES.standard,seeded(14)).amount,250);
});

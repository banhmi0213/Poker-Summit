const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {pickRingMove}=require('../lib/poker/ring-auto-move.ts');
const t=(id,sb,bb,occupied,extra={})=>({id,title:id,capacity:6,sb,bb,minBuyIn:bb*40,maxBuyIn:bb*100,occupied,...extra});
const low={bps:500,capBb:5},high={bps:1000,capBb:10};
const rakes=new Map([['a',low],['b',low],['c',high],['d',low],['e',low]]);

test('a busy table never moves',()=>{const a=t('a',1,2,3);assert.equal(pickRingMove(a,[a,t('b',1,2,4)],rakes,200,0),null);});
test('a short table moves to the busiest same-rate table without asking',()=>{
 const a=t('a',1,2,2),m=pickRingMove(a,[a,t('b',1,2,3),t('c',1,2,5),t('d',2,5,4)],rakes,150,0);
 assert.equal(m.target.id,'b');assert.equal(m.sameRate,true);assert.equal(m.amount,150);
});
test('the rake must match for a same-rate move',()=>{
 const a=t('a',1,2,1),m=pickRingMove(a,[a,t('c',1,2,4)],rakes,150,0);
 assert.equal(m.target.id,'c');assert.equal(m.sameRate,false);
});
test('a full or empty table is not a destination',()=>{const a=t('a',1,2,2);assert.equal(pickRingMove(a,[a,t('b',1,2,6),t('d',1,2,1),t('e',1,2,0)],rakes,150,0),null);});
test('another rate is offered when no same-rate seat exists, nearest blinds first',()=>{
 const a=t('a',1,2,2),m=pickRingMove(a,[a,t('d',2,5,3),t('e',5,10,5)],rakes,150,1000);
 assert.equal(m.target.id,'d');assert.equal(m.sameRate,false);assert.equal(m.amount,200);
});
test('a rate the player cannot afford is skipped',()=>{const a=t('a',1,2,2);assert.equal(pickRingMove(a,[a,t('e',5,10,4)],rakes,150,0),null);});
test('a big stack keeps the maximum; the rest stays in the wallet',()=>{const a=t('a',1,2,1),m=pickRingMove(a,[a,t('b',1,2,3)],rakes,320,0);assert.equal(m.amount,200);});
test('a short stack tops up to the minimum from the wallet only when it can',()=>{
 const a=t('a',1,2,1);assert.equal(pickRingMove(a,[a,t('b',1,2,3)],rakes,40,100).amount,80);
 assert.equal(pickRingMove(a,[a,t('b',1,2,3)],rakes,40,10),null);
});
test('two equally short tables merge one way only',()=>{const a=t('a',1,2,2),b=t('b',1,2,2);assert.equal(pickRingMove(a,[a,b],rakes,150,0),null);assert.equal(pickRingMove(b,[a,b],rakes,150,0).target.id,'a');});

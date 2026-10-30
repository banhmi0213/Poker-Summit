const {test}=require('node:test'),assert=require('node:assert/strict');
require('../scripts/poker-gto/common.cjs');
const {icmEquity,icmPushFold}=require('../lib/poker/icm.ts');
const equity=require('../data/poker-gto/preflop-equity.json'),hu=require('../data/poker-gto/hu-pushfold.json');
test('ICM prize equity matches the textbook example and sums to the prize pool',()=>{
 const e=icmEquity([5000,3000,2000],[50,30,20]);
 assert.deepEqual(e.map(x=>Math.round(x*100)/100),[38.39,32.75,28.86]);
 assert.ok(Math.abs(e.reduce((a,b)=>a+b,0)-100)<1e-9);
 assert.deepEqual(icmEquity([1,0,1],[60,40]).map(x=>Math.round(x)),[50,0,50]);
});
test('push/fold: chip EV heads-up matches the heads-up chart; prizes make the caller tighter',()=>{
 const r=icmPushFold({players:[{pos:'SB',stack:10},{pos:'BB',stack:10}],ante:0,payouts:[1],chipEv:true,iterations:300},equity);
 assert.ok(Math.abs(r.jamPct[0]-hu.spots['10'].pushPct)<2,'push '+r.jamPct[0]);
 assert.ok(Math.abs(r.callPct[0][1]-hu.spots['10'].callPct)<2,'call '+r.callPct[0][1]);
 const players=[{pos:'BTN',stack:12},{pos:'SB',stack:20},{pos:'BB',stack:10}];
 const chip=icmPushFold({players,ante:1,payouts:[50,30,20],others:[15],chipEv:true,iterations:200},equity),icm=icmPushFold({players,ante:1,payouts:[50,30,20],others:[15],iterations:200},equity);
 assert.ok(icm.callPct[0][2]<chip.callPct[0][2],'the big blind calls the button less with prizes on the line');
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const eq=require('../data/poker-gto/preflop-equity.json'),pf=require('../data/poker-gto/hu-pushfold.json');
const e=(a,b)=>eq.eq[eq.labels.indexOf(a)][eq.labels.indexOf(b)]/10000;
test('preflop equity table matches well-known matchups and is antisymmetric',()=>{
 assert.equal(eq.labels.length,169);
 for(const [a,b,v] of [['AA','KK',0.82],['AKs','QQ',0.46],['KK','AKs',0.66],['72o','AA',0.12],['JTs','AKo',0.40]])assert.ok(Math.abs(e(a,b)-v)<0.015,`${a} v ${b} ${e(a,b)}`);
 for(let i=0;i<169;i+=7)for(let j=0;j<169;j+=11)assert.ok(Math.abs(eq.eq[i][j]+eq.eq[j][i]-10000)<=1);
});
test('heads-up push/fold is a near-exact equilibrium with sensible ranges',()=>{
 for(const s of pf.stacks){const spot=pf.spots[s];assert.ok(spot.exploit<0.002,`${s}bb exploit ${spot.exploit}`);assert.equal(spot.push.AA,1);assert.equal(spot.call.AA,1);}
 for(let k=1;k<pf.stacks.length;k++)assert.ok(pf.spots[pf.stacks[k]].pushPct<=pf.spots[pf.stacks[k-1]].pushPct+1.5,'push range shrinks as stacks grow');
 assert.ok(pf.spots['10'].pushPct>55&&pf.spots['10'].pushPct<62);assert.ok(!pf.spots['25'].call['72o']);
});

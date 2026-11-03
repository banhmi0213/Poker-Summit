const {test}=require('node:test'),assert=require('node:assert/strict');
require('../scripts/poker-gto/common.cjs');
const {resolveFlopSelection}=require('../lib/poker/flop-selection.ts');
test('a computed board or its suit-equivalent uses its exact indexed answer',()=>{
 const index=['Kh7d2c','AhAd7c'];
 const exact=resolveFlopSelection('Ks7c2d',index);assert.equal(exact.flop,'Kh7d2c');assert.equal(exact.exact,true);assert.match(exact.note,/計算済み/);assert.doesNotMatch(exact.note,/未計算/);
});
test('an uncomputed board shows which nearest computed answer is substituted',()=>{
 const r=resolveFlopSelection('Kh7h3c',['Kh7d2c','Kh7h2c']);assert.equal(r.flop,'Kh7h2c');assert.equal(r.exact,false);assert.match(r.note,/未計算/);assert.match(r.note,/一番近い計算済み/);
 assert.equal(resolveFlopSelection('Kh7d2c',[]),null);assert.equal(resolveFlopSelection('KhKh2c',['Kh7d2c']),null);
});

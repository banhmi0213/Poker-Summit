const {test}=require('node:test'),assert=require('node:assert/strict');
const daily=require('../data/poker-gto/daily-quiz.json');
test('daily GTO quiz: five questions every day for a year ahead, 3 preflop + 2 flop, answers sum to 1',()=>{
 const days=Object.keys(daily.days).sort();
 assert.ok(days.length>=365);
 for(let i=1;i<days.length;i++)assert.equal(Date.parse(days[i])-Date.parse(days[i-1]),864e5,'no gap at '+days[i]);
 for(const d of days){const qs=daily.days[d];assert.equal(qs.length,5,d);
  assert.equal(qs.filter(q=>q.kind==='preflop').length,3,d);assert.equal(qs.filter(q=>q.kind==='flop').length,2,d);
  for(const q of qs){assert.equal(q.options.length,q.freqs.length);assert.ok(Math.abs(q.freqs.reduce((a,b)=>a+b,0)-1)<0.01,d+' '+q.title);assert.equal(q.cards.length,2);
   assert.ok(!/賞金|賭/.test(JSON.stringify(q)));}}
});

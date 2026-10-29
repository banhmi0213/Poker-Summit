const {test}=require('node:test'),assert=require('node:assert/strict');
const {chartSpot}=require('../scripts/poker-gto/chart-ranges.cjs'),SPOTS=require('../scripts/poker-gto/spots.cjs');
test('every flop spot takes its ranges, pot and stack from the preflop chart',()=>{
 for(const [id,s] of Object.entries(SPOTS)){
  const c=chartSpot(s.line,s.chart);assert.equal(c.oop,s.oop,id+' OOP');assert.equal(c.ip,s.ip,id+' IP');
  assert.ok(Object.keys(c.ranges.oop).length>5&&Object.keys(c.ranges.ip).length>5,id+' ranges');
  for(const w of [...Object.values(c.ranges.oop),...Object.values(c.ranges.ip)])assert.ok(w>0&&w<=1);
 }
 const btn=chartSpot(SPOTS['btn-bb'].line);assert.equal(btn.pot,5.5);assert.equal(btn.stack,97.5);
 assert.equal(chartSpot(SPOTS['co-btn-3bet'].line).pot,16.5,'BTN 3-bets CO to 7.5 in the chart');
 assert.equal(chartSpot(SPOTS['btn-bb-4bet'].line).pot,48.9);
 assert.equal(chartSpot(SPOTS['hu-limp'].line,'hu').pot,2,'heads-up limped pot');assert.equal(chartSpot(SPOTS['hu-srp'].line,'hu').oop,'BB','heads-up: BB acts first after the flop');
 assert.equal(btn.ranges.ip.AA,1,'BTN always opens AA');assert.equal(btn.ranges.ip['72o'],undefined,'BTN never opens 72o');
});

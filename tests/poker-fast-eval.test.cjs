const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {bestOfSeven,compareScores,createDeck}=require('../lib/poker/engine.ts');
const {evalCards}=require('../lib/poker/fast-eval.ts');
const seeded=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
test('fast evaluator orders 7-card hands exactly like the settlement evaluator',()=>{
 const rnd=seeded(42),deck=createDeck();
 const draw=()=>{const d=deck.slice();for(let i=0;i<14;i++){const k=i+Math.floor(rnd()*(d.length-i));[d[i],d[k]]=[d[k],d[i]];}return [d.slice(0,7),d.slice(7,14)];};
 for(let i=0;i<40000;i++){const [a,b]=draw();assert.equal(Math.sign(evalCards(a)-evalCards(b)),compareScores(bestOfSeven(a),bestOfSeven(b)),JSON.stringify([a,b]));}
});
test('edge cases: wheel, steel wheel, flush vs full house, two trips, three pairs',()=>{
 const c=(r,s)=>({rank:r,suit:s});
 const pairs=[
  [[c(14,'s'),c(2,'d'),c(3,'c'),c(4,'h'),c(5,'s'),c(9,'d'),c(13,'c')],[c(6,'s'),c(2,'d'),c(3,'c'),c(4,'h'),c(5,'s'),c(9,'d'),c(13,'c')]],
  [[c(14,'s'),c(2,'s'),c(3,'s'),c(4,'s'),c(5,'s'),c(9,'d'),c(13,'c')],[c(13,'s'),c(12,'s'),c(10,'s'),c(4,'s'),c(5,'s'),c(5,'d'),c(5,'c')]],
  [[c(9,'s'),c(9,'d'),c(9,'c'),c(4,'h'),c(4,'s'),c(4,'d'),c(13,'c')],[c(9,'s'),c(9,'d'),c(9,'c'),c(13,'h'),c(13,'s'),c(2,'d'),c(3,'c')]],
  [[c(9,'s'),c(9,'d'),c(8,'c'),c(8,'h'),c(4,'s'),c(4,'d'),c(13,'c')],[c(9,'s'),c(9,'d'),c(8,'c'),c(8,'h'),c(4,'s'),c(4,'d'),c(12,'c')]],
 ];
 for(const [a,b] of pairs)assert.equal(Math.sign(evalCards(a)-evalCards(b)),compareScores(bestOfSeven(a),bestOfSeven(b)));
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('app/learn/level-four-content.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports);
const {expectedValues,remainingCombos,mixedAction,levelFourLessons,levelFourExam,scoreLevelFour,parseLevelFourProgress,LEVEL_FOUR_PASS_SCORE,LEVEL_FOUR_STORAGE_KEY,outputExamples}=m.exports;

test('call EV uses net winnings and has the correct break-even point',()=>{
 assert.equal(expectedValues(1000,500,35,40).callEv,200);
 assert.equal(expectedValues(800,400,25,40).callEv,0);
 assert.equal(expectedValues(1000,500,0,40).callEv,-500);
 assert.equal(expectedValues(1000,500,100,40).callEv,1500);
 assert.equal(expectedValues(1000,500,25,40).requiredEquity,25);
});
test('pure bluff EV and break-even include only the opponent fold/call model',()=>{
 assert.equal(expectedValues(1000,1000,0,60).bluffEv,200);
 assert.equal(expectedValues(1000,1000,0,50).bluffEv,0);
 assert.equal(expectedValues(1000,1000,0,0).bluffEv,-1000);
 assert.equal(expectedValues(1000,1000,0,100).bluffEv,1000);
 for(const args of [[0,100,40,40],[100,0,40,40],[100,100,101,40],[100,100,40,-1],[NaN,100,40,40]])assert.equal(expectedValues(...args),null);
});
test('combos enumerate actual unique pairs and exclude every dead card',()=>{
 assert.deepEqual(['AA','AKs','AKo'].map(h=>remainingCombos(h).length),[6,4,12]);
 assert.deepEqual(['AA','AKs','AKo'].map(h=>remainingCombos(h,['As']).length),[3,3,9]);
 assert.deepEqual(['AA','AKs','AKo'].map(h=>remainingCombos(h,['As','Kd']).length),[3,2,7]);
 for(const hand of ['AA','AKs','AKo'])for(const dead of [[],['As'],['As','Kd']]){const c=remainingCombos(hand,dead);assert.equal(new Set(c.map(v=>[...v].sort().join(''))).size,c.length);assert.ok(c.every(v=>v[0]!==v[1]&&v.every(card=>!dead.includes(card))));}
});
test('mixed strategy uses exactly the requested integer percentage, including boundaries',()=>{
 for(const f of [0,20,40,80,100])assert.equal(Array.from({length:100},(_,i)=>mixedAction(i,f)).filter(v=>v==='bet').length,f);
 assert.equal(mixedAction(39,40),'bet');assert.equal(mixedAction(40,40),'check');
 for(const a of [[-1,40],[100,40],[3.5,40],[20,101]])assert.equal(mixedAction(...a),null);
});
test('Lv4 progress is separate and rejects stale IDs, duplicates, invalid scores and malformed JSON',()=>{
 assert.notEqual(LEVEL_FOUR_STORAGE_KEY,'poker-summit-academy-level3-v1');
 assert.deepEqual(parseLevelFourProgress(JSON.stringify({completed:['ev','ev','ranges',false,'combos'],bestScore:10})),{completed:['ev','combos'],bestScore:10});
 for(const v of [null,'[]','null','{bad'])assert.deepEqual(parseLevelFourProgress(v),{completed:[],bestScore:null});
 for(const v of [-1,13,9.2,'10'])assert.equal(parseLevelFourProgress(JSON.stringify({bestScore:v})).bestScore,null);
});
test('exam has a ten-out-of-twelve boundary and unanswered questions do not score',()=>{
 const a=levelFourExam.map(q=>q.answer);assert.equal(a.length,12);assert.equal(scoreLevelFour(a),12);assert.equal(scoreLevelFour([]),0);assert.equal(scoreLevelFour(a.slice(0,9)),LEVEL_FOUR_PASS_SCORE-1);assert.equal(scoreLevelFour(a.slice(0,10)),LEVEL_FOUR_PASS_SCORE);
});
test('every topic has two practice questions, distinct IDs, explanations, and valid choices',()=>{
 assert.equal(levelFourLessons.length,6);const all=[...levelFourExam,...levelFourLessons.flatMap(l=>l.questions)];assert.equal(new Set(all.map(q=>q.id)).size,24);
 for(const l of levelFourLessons)assert.equal(l.questions.length,2);
 for(const q of all)assert.ok(q.situation&&q.explanation&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length);
 for(const e of outputExamples)assert.equal(e.rows.reduce((s,r)=>s+r.frequency,0),100);
});

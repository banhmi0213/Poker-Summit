const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('app/learn/level-three-content.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText)(mod, mod.exports);
const { levelThreeLessons, levelThreeExam, scoreLevelThree, LEVEL_THREE_PASS_SCORE, parseLevelThreeProgress, sprMetrics, betMetrics } = mod.exports;

test('SPR uses remaining effective stacks at the same point, including after a bet/call', () => {
 assert.deepEqual(sprMetrics(8000, 3000, 1000), {effective: 3000, spr: 3});
 assert.deepEqual(sprMetrics(2500, 2500, 2000), {effective: 2500, spr: 1.25});
 for (const values of [[100, 100, 0], [-1, 10, 10], [NaN, 10, 10], [10, Infinity, 10]]) assert.equal(sprMetrics(...values), null);
});
test('bet sizes include both the bet and the call in the final pot', () => {
 assert.deepEqual(betMetrics(1000, 0.5), {bet: 500, finalPot: 2000, requiredEquity: 25});
 assert.ok(Math.abs(betMetrics(1000, 1).requiredEquity - 100/3) < 1e-10);
});
test('exam pass boundary is ten out of twelve; an unanswered question never scores', () => {
 const right = levelThreeExam.map(q => q.answer);
 const wrong = right.map(a => (a + 1) % 3);
 assert.equal(scoreLevelThree(right), 12);
 assert.equal(scoreLevelThree([]), 0);
 assert.equal(scoreLevelThree(right.slice(0, 9)), LEVEL_THREE_PASS_SCORE - 1);
 assert.equal(scoreLevelThree([...right.slice(0, 10), ...wrong.slice(10)]), LEVEL_THREE_PASS_SCORE);
 assert.equal(scoreLevelThree(wrong), 0);
});
test('stored progress handles blocked/malformed shapes and only restores known lessons and bounded scores', () => {
 for (const raw of [null, 'bad JSON', 'null', '[]', '"text"']) assert.deepEqual(parseLevelThreeProgress(raw), {completed: [], bestScore: null});
 const data = parseLevelThreeProgress(JSON.stringify({completed: ['ranges', 'ranges', 'unknown', 3, 'spr'], bestScore: 10}));
 assert.deepEqual(data, {completed: ['ranges', 'spr'], bestScore: 10});
 for (const score of [-1, 13, 10.5, '12']) assert.equal(parseLevelThreeProgress(JSON.stringify({bestScore: score})).bestScore, null);
});
test('practice and exam cover every lesson with valid, separately identified questions', () => {
 assert.equal(levelThreeLessons.length, 6);
 assert.equal(levelThreeExam.length, 12);
 const all = [...levelThreeLessons.flatMap(lesson => lesson.questions), ...levelThreeExam];
 assert.equal(new Set(all.map(q => q.id)).size, all.length);
 for (const lesson of levelThreeLessons) assert.equal(lesson.questions.length, 2);
 for (const q of all) { assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length); assert.ok(q.situation && q.explanation); }
});

// Run: npm run test:poker
// The project already depends on TypeScript; load pure TS engine modules without
// adding a runtime test framework or changing Next.js bundling.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
const { calculateSidePots, createBettingRound, applyBettingAction, legalBettingActions } = require("../lib/poker/betting.ts");
const { settleShowdown } = require("../lib/poker/settlement.ts");
const { settleCompletedHand } = require("../lib/poker/hand-settlement.ts");
const { beginNextBettingStreet } = require("../lib/poker/betting.ts");
const C = (rank, suit) => ({ rank, suit });
const board = [C(2,"c"), C(5,"d"), C(8,"h"), C(11,"s"), C(13,"c")];
const hole = {
  A: [C(14,"h"), C(14,"d")],
  B: [C(12,"h"), C(12,"d")],
  C: [C(9,"h"), C(9,"d")],
  D: [C(3,"h"), C(4,"d")],
};
const entry = (id, totalCommitted, folded = false) => ({ id, totalCommitted, folded, hole: hole[id] });
const sum = values => Object.values(values).reduce((a,b) => a+b, 0);

test("three unequal all-ins produce correct layered side pots and eligible seats", () => {
  const pots = calculateSidePots([entry("A",100),entry("B",200),entry("C",300)]);
  assert.deepEqual(pots, [
    { amount: 300, eligible: ["A","B","C"] },
    { amount: 200, eligible: ["B","C"] },
    { amount: 100, eligible: ["C"] },
  ]);
  const result = settleShowdown([entry("A",100),entry("B",200),entry("C",300)],board,["A","B","C"],"C");
  assert.deepEqual(result.payouts, { A:300, B:200, C:100 });
  assert.equal(sum(result.payouts), 600);
});

test("folded chips remain in pots but folded player cannot win", () => {
  const entries = [entry("A",100),entry("B",200),entry("C",200),entry("D",200,true)];
  const result = settleShowdown(entries,board,["A","B","C","D"],"D");
  assert.deepEqual(result.payouts, { A:400, B:300, C:0, D:0 });
  assert.equal(sum(result.payouts), 700);
});

test("uncalled excess layer returns to its only eligible contributor", () => {
  const entries = [entry("A",100),entry("B",200),entry("C",300)];
  const result = settleShowdown(entries,board,["A","B","C"],"A");
  assert.equal(result.payouts.C,100);
  assert.equal(sum(result.payouts),600);
});

test("tied board divides pot with odd chip clockwise after button", () => {
  const tiedBoard = [C(10,"c"),C(11,"c"),C(12,"c"),C(13,"c"),C(14,"c")];
  const entries = [entry("A",1),entry("B",1),entry("C",1)];
  const result = settleShowdown(entries,tiedBoard,["A","B","C"],"A");
  assert.deepEqual(result.payouts,{A:1,B:1,C:1});
  const twoEligible = [entry("A",1),entry("B",1),entry("C",1,true)];
  const split = settleShowdown(twoEligible,tiedBoard,["A","B","C"],"C");
  assert.deepEqual(split.payouts,{A:2,B:1,C:0});
  assert.deepEqual(split.awards[0].oddChips,["A"]);
});

test("no extra wager when every opponent is all-in", () => {
  const round = createBettingRound([
    {id:"A",stack:300,committed:100},
    {id:"B",stack:0,committed:100,allIn:true},
  ],100,"A");
  assert.equal(round.toAct,null);
  assert.equal(legalBettingActions(round,"A"),null);
});

test("outstanding call against all-in opponent allows only call/fold, not raise", () => {
  const round = createBettingRound([
    {id:"A",stack:300,committed:100},
    {id:"B",stack:0,committed:200,allIn:true},
  ],100,"A");
  assert.equal(round.toAct,"A");
  assert.deepEqual(legalBettingActions(round,"A"),{
    fold:true,check:false,call:true,callAmount:100,
    raise:false,minRaiseTo:null,maxRaiseTo:null,shortAllInOnly:false,
  });
  assert.throws(()=>applyBettingAction(round,"A",{type:"raise",amount:300}),/all-in/);
  const called=applyBettingAction(round,"A",{type:"call"});
  assert.equal(called.toAct,null);
  assert.equal(called.players[0].totalCommitted,200);
});

test("side pot rejects duplicate players and unsafe arithmetic", () => {
  assert.throws(()=>calculateSidePots([entry("A",10),entry("A",10)]),/Duplicate/);
  assert.throws(()=>calculateSidePots([entry("A",Number.MAX_SAFE_INTEGER),entry("B",Number.MAX_SAFE_INTEGER)]),/safe integer/);
});

const finish = (round, river = false, cards = board) =>
  settleCompletedHand(round, cards, hole, round.players.map(p => p.id), "A", river);
const conserved = (round, result, initial) => {
  assert.equal(round.players.reduce((n,p) => n + p.stack + result.payouts[p.id], 0), initial);
};

test("actual unequal all-in actions run out and settle every side pot", () => {
  let round = createBettingRound([{id:"A",stack:100},{id:"B",stack:200},{id:"C",stack:300}],100,"A");
  round = applyBettingAction(round,"A",{type:"bet",amount:100});
  round = applyBettingAction(round,"B",{type:"raise",amount:200});
  round = applyBettingAction(round,"C",{type:"call"});
  assert.equal(round.toAct,null);
  const result = finish(round);
  assert.equal(result.showdown,true);
  assert.deepEqual(result.payouts,{A:300,B:200,C:0});
  conserved(round,result,600);
});

test("all players exhausting their stacks still receive payouts", () => {
  let round = createBettingRound([{id:"A",stack:100},{id:"B",stack:100}],100,"A");
  round = applyBettingAction(round,"A",{type:"bet",amount:100});
  round = applyBettingAction(round,"B",{type:"call"});
  assert.ok(round.players.every(p=>p.allIn));
  const result = finish(round);
  assert.deepEqual(result.payouts,{A:200,B:0});
  conserved(round,result,200);
  assert.deepEqual(finish(round),result); // Resolving again does not mutate stacks or add a second award.
});

test("fold to an all-in awards the whole pot without a board", () => {
  let round = createBettingRound([{id:"A",stack:300},{id:"B",stack:300}],100,"A");
  round = applyBettingAction(round,"A",{type:"bet",amount:300});
  round = applyBettingAction(round,"B",{type:"fold"});
  const result = finish(round,false,[]);
  assert.equal(result.showdown,false);
  assert.deepEqual(result.payouts,{A:300,B:0});
  conserved(round,result,600);
});

test("unfinished action and incomplete all-in board cannot settle", () => {
  let round = createBettingRound([{id:"A",stack:100},{id:"B",stack:100}],100,"A");
  assert.throws(()=>finish(round),/not complete/);
  round = applyBettingAction(round,"A",{type:"bet",amount:100});
  round = applyBettingAction(round,"B",{type:"call"});
  assert.throws(()=>finish(round,false,board.slice(0,3)),/five board/);
});

test("normal streets retain contributions and settle only after river", () => {
  let round = createBettingRound([{id:"A",stack:500},{id:"B",stack:500}],100,"A");
  round = applyBettingAction(round,"A",{type:"bet",amount:100});
  round = applyBettingAction(round,"B",{type:"call"});
  assert.equal(finish(round),null);
  for (let street = 0; street < 3; street++) {
    round = beginNextBettingStreet(round,"B");
    round = applyBettingAction(round,"B",{type:"check"});
    round = applyBettingAction(round,"A",{type:"check"});
    if (street < 2) assert.equal(finish(round),null);
  }
  const result = finish(round,true);
  assert.deepEqual(result.payouts,{A:200,B:0});
  conserved(round,result,1000);
});

test("short all-in call returns unmatched excess and conserves chips", () => {
  let round = createBettingRound([{id:"A",stack:300},{id:"B",stack:100}],100,"A");
  round = applyBettingAction(round,"A",{type:"bet",amount:300});
  round = applyBettingAction(round,"B",{type:"call"});
  const result = finish(round);
  assert.deepEqual(result.payouts,{A:400,B:0});
  conserved(round,result,400);
});

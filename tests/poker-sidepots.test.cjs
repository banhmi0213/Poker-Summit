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
// Include the original engine tests in the same CI command; previously these
// TypeScript suites existed but were not loaded by npm run test:poker.
require("../lib/poker/betting.test.ts");
require("../lib/poker/settlement.test.ts");
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

const seatsRound = stacks => createBettingRound(stacks.map((stack,i)=>({id:String.fromCharCode(65+i),stack})),100,"A");
const act = (r,id,type,amount) => applyBettingAction(r,id,amount === undefined ? {type} : {type,amount});
const unchangedOnError = (r, action, pattern) => {
  const snapshot = structuredClone(r);
  assert.throws(action,pattern);
  assert.deepEqual(r,snapshot);
};

test("opening minimum, full raise increment and legal amounts agree", () => {
  let r = seatsRound([1000,1000,1000]);
  unchangedOnError(r,()=>act(r,"A","bet",99),/minimum/);
  r = act(r,"A","bet",100);
  r = act(r,"B","raise",300);
  assert.equal(legalBettingActions(r,"C").minRaiseTo,500);
  unchangedOnError(r,()=>act(r,"C","raise",499),/minimum/);
  r = act(r,"C","raise",500);
  assert.equal(r.toAct,"A");
  assert.equal(legalBettingActions(r,"A").minRaiseTo,700);
});

test("one short all-in does not reopen the original bettor", () => {
  let r = seatsRound([1000,150,1000]);
  r = act(r,"A","bet",100);
  r = act(r,"B","raise",150);
  r = act(r,"C","call");
  assert.equal(r.toAct,"A");
  assert.equal(legalBettingActions(r,"A").raise,false);
  unchangedOnError(r,()=>act(r,"A","raise",250),/reopened/);
  r = act(r,"A","call");
  assert.equal(r.toAct,null);
});

test("cumulative short all-ins reopen only seats facing a full raise", () => {
  let r = seatsRound([1000,150,1000,200,1000]);
  r = act(r,"A","bet",100);
  r = act(r,"B","raise",150);
  r = act(r,"C","call");
  r = act(r,"D","raise",200);
  r = act(r,"E","call");
  assert.equal(r.toAct,"A");
  assert.equal(r.minRaise,100);
  assert.equal(legalBettingActions(r,"A").raise,true);
  assert.equal(legalBettingActions(r,"A").minRaiseTo,300);
  const raised = act(r,"A","raise",300);
  assert.equal(raised.toAct,"C");
  assert.equal(legalBettingActions(raised,"C").raise,true);
  r = act(r,"A","call");
  assert.equal(r.toAct,"C");
  assert.equal(legalBettingActions(r,"C").raise,false);
  unchangedOnError(r,()=>act(r,"C","raise",300),/reopened/);
});

test("cumulative short raises below the full increment stay closed", () => {
  let r = seatsRound([1000,140,190,1000]);
  r = act(r,"A","bet",100);
  r = act(r,"B","raise",140);
  r = act(r,"C","raise",190);
  r = act(r,"D","call");
  assert.equal(legalBettingActions(r,"A").raise,false);
  unchangedOnError(r,()=>act(r,"A","raise",290),/reopened/);
});

test("checker facing a full opening bet can raise", () => {
  let r = seatsRound([1000,1000,1000]);
  r = act(r,"A","check");
  r = act(r,"B","bet",100);
  r = act(r,"C","call");
  assert.equal(legalBettingActions(r,"A").raise,true);
  r = act(r,"A","raise",200);
  assert.equal(r.toAct,"B");
});

test("unacted seat can make a full raise after a short all-in", () => {
  let r = seatsRound([1000,150,1000]);
  r = act(r,"A","bet",100);
  r = act(r,"B","raise",150);
  assert.equal(legalBettingActions(r,"C").minRaiseTo,250);
  r = act(r,"C","raise",250);
  assert.equal(legalBettingActions(r,"A").raise,true);
});

test("six-seat preflop includes BB option then postflop starts after BTN", () => {
  const {postBlinds} = require("../lib/poker/settlement.ts");
  const ids = ["A","B","C","D","E","F"];
  const posted = postBlinds(ids.map(id=>({id,stack:1000})),0,50,100);
  let r = createBettingRound(posted.players,100,posted.positions.preflopFirst);
  for (const id of ["D","E","F","A","B"]) {
    assert.equal(r.toAct,id);
    r = act(r,id,"call");
  }
  assert.equal(r.toAct,"C");
  assert.equal(legalBettingActions(r,"C").raise,true);
  r = act(r,"C","check");
  assert.equal(r.toAct,null);
  r = beginNextBettingStreet(r,posted.positions.postflopFirst);
  for (const id of ["B","C","D","E","F","A"]) {
    assert.equal(r.toAct,id);
    r = act(r,id,"check");
  }
  assert.equal(r.toAct,null);
  assert.equal(r.players.reduce((n,p)=>n+p.stack+p.totalCommitted,0),6000);
});

test("heads-up action is BTN preflop and BB postflop", () => {
  const {postBlinds} = require("../lib/poker/settlement.ts");
  const p = postBlinds([{id:"A",stack:1000},{id:"B",stack:1000}],0,50,100);
  let r = createBettingRound(p.players,100,p.positions.preflopFirst);
  assert.equal(r.toAct,"A");
  r = act(r,"A","call");
  r = act(r,"B","check");
  r = beginNextBettingStreet(r,p.positions.postflopFirst);
  assert.equal(r.toAct,"B");
});

test("wrong turn and premature street transition leave chips unchanged", () => {
  const r = seatsRound([1000,1000,1000]);
  unchangedOnError(r,()=>act(r,"B","fold"),/turn/);
  unchangedOnError(r,()=>beginNextBettingStreet(r,"B"),/not complete/);
  unchangedOnError(r,()=>act(r,"A","call"),/Nothing/);
});

test("folded and all-in seats are skipped while calls preserve total chips", () => {
  let r = seatsRound([1000,100,1000,1000]);
  r = act(r,"A","bet",100);
  r = act(r,"B","call");
  r = act(r,"C","fold");
  r = act(r,"D","call");
  assert.equal(r.toAct,null);
  r = beginNextBettingStreet(r,"D");
  assert.equal(r.toAct,"D");
  r = act(r,"D","check");
  assert.equal(r.toAct,"A");
  r = act(r,"A","check");
  assert.equal(r.toAct,null);
  assert.equal(r.players.reduce((n,p)=>n+p.stack+p.totalCommitted,0),3100);
});

test("cumulative reopening keeps the last full raise increment, not BB", () => {
  let r = seatsRound([2000,2000,450,500,2000]);
  r = act(r,"A","bet",100);
  r = act(r,"B","raise",300);
  r = act(r,"C","raise",450);
  r = act(r,"D","raise",500);
  r = act(r,"E","call");
  r = act(r,"A","call");
  assert.equal(r.toAct,"B");
  assert.equal(legalBettingActions(r,"B").minRaiseTo,700);
  unchangedOnError(r,()=>act(r,"B","raise",600),/minimum/);
  r = act(r,"B","raise",700);
  assert.equal(r.minRaise,200);
});

test("three kings beat pocket aces in both eligible pots", () => {
  const cards = [C(2,"c"),C(7,"d"),C(9,"h"),C(11,"s"),C(13,"c")];
  const entries = [
    {id:"A",totalCommitted:100,folded:false,hole:[C(14,"h"),C(14,"d")]},
    {id:"B",totalCommitted:300,folded:false,hole:[C(13,"h"),C(13,"d")]},
    {id:"C",totalCommitted:300,folded:false,hole:[C(3,"h"),C(4,"d")]},
  ];
  assert.deepEqual(settleShowdown(entries,cards,["A","B","C"],"C").payouts,{A:0,B:700,C:0});
});

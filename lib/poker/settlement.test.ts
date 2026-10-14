import { strict as assert } from "node:assert";
import { test } from "node:test";
import { positions, postBlinds, settleShowdown } from "./settlement";
import type { Card } from "./engine";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

test("six-handed positions rotate clockwise and preflop starts left of BB", () => {
  const seats = ["you", "p5", "p3", "p2", "p4", "p6"];
  assert.deepEqual(positions(seats, 5), { button: "p6", sb: "you", bb: "p5",
    preflopFirst: "p3", postflopFirst: "you", nextButtonIndex: 0 });
  assert.equal(positions(seats, 0).button, "you");
});

test("heads-up button is small blind and acts first preflop", () => {
  const p = positions(["a", "b"], 0);
  assert.equal(p.sb, "a");
  assert.equal(p.bb, "b");
  assert.equal(p.preflopFirst, "a");
  assert.equal(p.postflopFirst, "b");
});

test("blinds are deducted and short stacks post all-in", () => {
  const p = postBlinds([{ id: "a", stack: 25 }, { id: "b", stack: 300 }, { id: "c", stack: 300 }], 2, 50, 100);
  assert.equal(p.pot, 125);
  assert.equal(p.players[0].stack, 0);
  assert.equal(p.players[0].committed, 25);
  assert.equal(p.players[1].committed, 100);
});

test("side pots go to strongest eligible hands and preserve chips", () => {
  const board = [c(2,"c"),c(7,"d"),c(9,"h"),c(11,"s"),c(13,"c")];
  const entries = [
    { id: "a", totalCommitted: 100, folded: false, hole: [c(14,"h"),c(14,"d")] as const },
    { id: "b", totalCommitted: 300, folded: false, hole: [c(13,"h"),c(13,"d")] as const },
    { id: "c", totalCommitted: 300, folded: false, hole: [c(3,"h"),c(4,"d")] as const },
  ];
  const result = settleShowdown(entries, board, ["a","b","c"], "c");
  assert.deepEqual(result.payouts, { a: 300, b: 400, c: 0 });
  assert.equal(Object.values(result.payouts).reduce((a,b)=>a+b,0),700);
});

test("tied pot awards odd chip clockwise after button", () => {
  const board = [c(10,"h"),c(11,"h"),c(12,"h"),c(13,"h"),c(14,"h")];
  const entries = [
    { id:"a", totalCommitted:1, folded:false, hole:[c(2,"c"),c(3,"d")] as const },
    { id:"b", totalCommitted:1, folded:false, hole:[c(4,"c"),c(5,"d")] as const },
    { id:"c", totalCommitted:1, folded:false, hole:[c(6,"c"),c(7,"d")] as const },
  ];
  const result=settleShowdown(entries,board,["a","b","c"],"c");
  assert.deepEqual(result.payouts,{a:1,b:1,c:1});
});

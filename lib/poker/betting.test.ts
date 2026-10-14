import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyBettingAction, beginNextBettingStreet, calculateSidePots, createBettingRound, potTotal } from "./betting";

test("bet/call/check update virtual stacks and pot", () => {
  let round = createBettingRound([{ id: "a", stack: 1000 }, { id: "b", stack: 1000 }], 100, "a");
  round = applyBettingAction(round, "a", { type: "bet", amount: 200 });
  assert.equal(round.toAct, "b");
  round = applyBettingAction(round, "b", { type: "call" });
  assert.equal(round.toAct, null);
  assert.equal(potTotal(round), 400);
  assert.equal(round.players[0].stack, 800);
  assert.equal(round.players[1].stack, 800);
  round = beginNextBettingStreet(round, "b");
  assert.equal(round.currentBet, 0);
  assert.equal(potTotal(round), 400);
  round = applyBettingAction(round, "b", { type: "check" });
  round = applyBettingAction(round, "a", { type: "check" });
  assert.equal(round.toAct, null);
});

test("cannot check when facing a bet; cannot raise below minimum", () => {
  let round = createBettingRound([{ id: "a", stack: 1000 }, { id: "b", stack: 1000 }], 100, "a");
  round = applyBettingAction(round, "a", { type: "bet", amount: 200 });
  assert.throws(() => applyBettingAction(round, "b", { type: "check" }));
  assert.throws(() => applyBettingAction(round, "b", { type: "raise", amount: 250 }));
});

test("fold ends the round when one player remains", () => {
  let round = createBettingRound([{ id: "a", stack: 1000 }, { id: "b", stack: 1000 }], 100, "a");
  round = applyBettingAction(round, "a", { type: "fold" });
  assert.equal(round.toAct, null);
  assert.equal(round.players[0].folded, true);
});

test("all-in call creates main and side pots", () => {
  const pots = calculateSidePots([
    { id: "a", totalCommitted: 100, folded: false },
    { id: "b", totalCommitted: 300, folded: false },
    { id: "c", totalCommitted: 300, folded: true },
  ]);
  assert.deepEqual(pots, [
    { amount: 300, eligible: ["a", "b"] },
    { amount: 400, eligible: ["b"] },
  ]);
});

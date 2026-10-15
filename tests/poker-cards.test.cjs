const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { createDeck, bestOfSeven, compareScores, scoreFive } = require('../lib/poker/engine.ts');
const { shuffleDeck } = require('../lib/poker/server-shuffle.ts');
const { startHand, advanceStreet } = require('../lib/poker/hand-state.ts');
const { dealDemoHand } = require('../lib/poker/demo-deal.ts');
const { cardLabel, isRedCard, handLabel } = require('../lib/poker/card-display.ts');
const { settleShowdown } = require('../lib/poker/settlement.ts');
const c = (rank, suit) => ({ rank, suit });
const keys = cards => cards.map(card => `${card.rank}${card.suit}`);
test('deck and server shuffle contain exactly the same 52 distinct cards', () => {
    const deck = createDeck(), snapshot = structuredClone(deck), shuffled = shuffleDeck(deck);
    assert.equal(deck.length, 52);
    assert.equal(new Set(keys(deck)).size, 52);
    assert.deepEqual(keys(shuffled).sort(), keys(deck).sort());
    assert.deepEqual(deck, snapshot);
    assert.notEqual(shuffled, deck);
});
test('two dealing rounds and 3/1/1 board use three separate burn cards', () => {
    let h = startHand(['A', 'B', 'C', 'D', 'E', 'F']);
    for (let i = 0; i < 6; i++)
        assert.deepEqual(h.players[i].hole, [h.deck[i], h.deck[i + 6]]);
    const original = h;
    h = advanceStreet(h);
    assert.deepEqual(h.board, h.deck.slice(13, 16));
    assert.equal(h.burns[0], h.deck[12]);
    h = advanceStreet(h);
    assert.deepEqual(h.board, [...h.deck.slice(13, 16), h.deck[17]]);
    h = advanceStreet(h);
    assert.deepEqual(h.board, [...h.deck.slice(13, 16), h.deck[17], h.deck[19]]);
    assert.deepEqual(h.burns, [h.deck[12], h.deck[16], h.deck[18]]);
    assert.equal(new Set(keys([...h.players.flatMap(p => p.hole), ...h.board, ...h.burns])).size, 20);
    assert.equal(original.board.length, 0);
    assert.equal(original.deckIndex, 12);
    h = advanceStreet(h);
    assert.equal(h.street, 'showdown');
    assert.throws(() => advanceStreet(h), /already/);
});
test('demo deal rotates first card left of BTN and exposes no unused deck', () => {
    // Replace only the RNG boundary so the distribution is deterministic.
    const rng = require('../lib/poker/server-shuffle.ts'), saved = rng.shuffleDeck;
    rng.shuffleDeck = () => createDeck();
    try {
        const ids = ['A', 'B', 'C', 'D', 'E', 'F'], deck = createDeck();
        for (let btn = 0; btn < 6; btn++) {
            const deal = dealDemoHand(ids, btn), first = ids[(btn + 1) % 6];
            assert.deepEqual(deal.holes[first], [deck[0], deck[6]]);
            assert.equal(deal.board.length, 5);
            assert.equal(new Set(keys([...Object.values(deal.holes).flat(), ...deal.board])).size, 17);
            assert.deepEqual(Object.keys(deal).sort(), ['board', 'holes']);
        }
    }
    finally {
        rng.shuffleDeck = saved;
    }
    assert.throws(() => dealDemoHand(['A', 'A'], 0), /unique/);
    assert.throws(() => dealDemoHand(['A', 'B'], 2), /button/);
});
test('heads-up dealing begins at BB, left of button', () => {
    const rng = require('../lib/poker/server-shuffle.ts'), saved = rng.shuffleDeck;
    rng.shuffleDeck = () => createDeck();
    try {
        const deck = createDeck(), deal = dealDemoHand(['A', 'B'], 0);
        assert.deepEqual(deal.holes.B, [deck[0], deck[2]]);
    }
    finally {
        rng.shuffleDeck = saved;
    }
});
test('all nine hand categories rank in the correct order', () => {
    const hands = [
        [c(14, 's'), c(11, 'h'), c(9, 'd'), c(6, 'c'), c(2, 's')],
        [c(14, 's'), c(14, 'h'), c(9, 'd'), c(6, 'c'), c(2, 's')],
        [c(14, 's'), c(14, 'h'), c(9, 'd'), c(9, 'c'), c(2, 's')],
        [c(14, 's'), c(14, 'h'), c(14, 'd'), c(6, 'c'), c(2, 's')],
        [c(10, 's'), c(9, 'h'), c(8, 'd'), c(7, 'c'), c(6, 's')],
        [c(14, 's'), c(11, 's'), c(9, 's'), c(6, 's'), c(2, 's')],
        [c(14, 's'), c(14, 'h'), c(14, 'd'), c(6, 'c'), c(6, 's')],
        [c(14, 's'), c(14, 'h'), c(14, 'd'), c(14, 'c'), c(2, 's')],
        [c(10, 's'), c(9, 's'), c(8, 's'), c(7, 's'), c(6, 's')],
    ];
    hands.forEach((cards, i) => { assert.equal(scoreFive(cards)[0], i); if (i)
        assert.equal(compareScores(scoreFive(cards), scoreFive(hands[i - 1])), 1); });
});
test('ace-low straight has five high and loses to a six-high straight', () => {
    const wheel = bestOfSeven([c(14, 's'), c(2, 'h'), c(3, 'd'), c(4, 'c'), c(5, 's'), c(9, 'h'), c(12, 's')]);
    const six = scoreFive([c(2, 's'), c(3, 'h'), c(4, 'd'), c(5, 'c'), c(6, 's')]);
    assert.deepEqual(wheel, [4, 5]);
    assert.equal(compareScores(six, wheel), 1);
});
test('best five can use zero, one or two hole cards', () => {
    const board = [c(10, 's'), c(11, 's'), c(12, 's'), c(13, 's'), c(14, 's')];
    assert.deepEqual(bestOfSeven([c(2, 'h'), c(3, 'd'), ...board]), [8, 14]);
    const four = [c(10, 's'), c(11, 's'), c(12, 's'), c(13, 's'), c(2, 'd')];
    assert.deepEqual(bestOfSeven([c(14, 's'), c(3, 'd'), ...four]), [8, 14]);
    const three = [c(10, 's'), c(11, 's'), c(12, 's'), c(2, 'h'), c(3, 'd')];
    assert.deepEqual(bestOfSeven([c(13, 's'), c(14, 's'), ...three]), [8, 14]);
});
test('full house selects highest trips and highest remaining pair', () => {
    assert.deepEqual(bestOfSeven([c(14, 's'), c(14, 'h'), c(14, 'd'), c(13, 's'), c(13, 'h'), c(13, 'd'), c(2, 'c')]), [6, 14, 13]);
});
test('same pair is decided by kicker, suits do not break tied ranks', () => {
    const a = scoreFive([c(9, 's'), c(9, 'h'), c(14, 'd'), c(12, 'c'), c(2, 's')]);
    const b = scoreFive([c(9, 'd'), c(9, 'c'), c(13, 'd'), c(12, 'h'), c(2, 'h')]);
    assert.equal(compareScores(a, b), 1);
    assert.equal(compareScores(a, scoreFive([c(9, 'd'), c(9, 'c'), c(14, 'h'), c(12, 's'), c(2, 'd')])), 0);
});
test('card colors, face ranks and role labels match settlement', () => {
    assert.equal(cardLabel(c(14, 's')), 'A♠');
    assert.equal(cardLabel(c(10, 'd')), '10♦');
    assert.equal(isRedCard(c(2, 'h')), true);
    assert.equal(isRedCard(c(2, 's')), false);
    const board = [c(2, 'c'), c(5, 'd'), c(8, 'h'), c(11, 's'), c(13, 'c')];
    const entries = [{ id: 'A', totalCommitted: 100, folded: false, hole: [c(14, 'h'), c(14, 'd')] }, { id: 'B', totalCommitted: 100, folded: false, hole: [c(12, 'h'), c(12, 'd')] }];
    assert.equal(handLabel(entries[0].hole, board), 'ワンペア（A）');
    assert.deepEqual(settleShowdown(entries, board, ['A', 'B'], 'B').payouts, { A: 200, B: 0 });
    const royal = [c(10, 'c'), c(11, 'c'), c(12, 'c'), c(13, 'c'), c(14, 'c')];
    assert.equal(handLabel(entries[0].hole, royal), 'ロイヤルフラッシュ');
});

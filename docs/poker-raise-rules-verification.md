# No-limit Hold'em raise rule verification

Scope: local virtual-chip poker engine only. This PR does not turn the browser demo into an authoritative multiplayer server.

## Raise-to examples (BB = 100)

- No prior wager on a postflop street: minimum BET-to is 100.
- A bet of 100 followed by a full raise: minimum RAISE-to is 200.
- A full raise to 300 after the previous bet of 100: next minimum RAISE-to is 500 (raise increment 200).
- A player with only 150 chips facing a 100 bet may go all-in to 150 as a **short raise**, but this alone does not reopen raising for players who have already acted.
- A full raise resets other eligible players' acted flags and permits a new raise.
- An already-acted player facing a short all-in can CALL or FOLD. Multiple short all-ins reopen raising if the increase since that player last acted reaches the last full bet/raise increment; a player who called an intermediate amount may still have no raise rights.
- If every opponent is all-in, no extra BET or RAISE is legal. The remaining player may CHECK if no amount is owed or CALL/FOLD if an amount is owed.
- A player with less than the call amount can CALL all-in for the remaining stack.

## Side pot cases for subsequent automated tests

- Contributions 100 / 200 / 300 create layered pots of 300, 200, and 100 chips; only eligible players may win each layer.
- Folded contributions remain in the pot, but folded players never receive a share.
- Equal winning hands split the eligible pot; odd chips follow clockwise order from the button.
- Uncalled excess chips must return to their sole contributor; pot settlement must not accidentally award them to a different player.
- Total stacks plus commitments before settlement must equal total stacks plus awards afterward.

## Verification status

These are acceptance scenarios to automate and test. This change provides a legal-action helper and blocks raises into an all-in-only field. It does **not** claim that all edge cases or the UI betting controls are already fully verified.

## Automated coverage update — 2026-10-16

Reference: https://www.pokertda.com/view-poker-tda-rules/ (accessed 2026-10-16 JST), current page sections 45 “Raise Amounts”, 49 “Re-Opening the Bet”, 50 “Number of Allowable Raises”. This is a no-limit Hold'em engine; physical chip gestures and floor penalties are outside the digital action API.

`npm run test:poker` now also loads the original betting.test.ts and settlement.test.ts suites (nine previously excluded tests). Added coverage checks opening minimums, full re-raise increments, single and cumulative short all-ins, player-relative reopening, checks followed by full bets, six-seat and heads-up action order, BB option, skipped folded/all-in seats, wrong turns, premature street transitions, and chip conservation.

Example: A bets 100, B all-in 150, C calls 150, D all-in 200, E calls. A faces a cumulative full raise of 100 and may raise to 300; if A only calls 200, C faces only 50 since calling 150 and cannot raise. The last full raise increment stays 100. UI remains the fixed-card local demo; these tests do not establish multiplayer readiness or exhaust all rule cases.

One old settlement fixture put K on the board with KK in hand but expected AA to win. Changed that fixture board to Q to preserve its intended split-pot scenario, and separately tested the original K board with the correct 700-chip award to three kings.

# No-limit Hold'em raise rule verification

Scope: local virtual-chip poker engine only. This PR does not turn the browser demo into an authoritative multiplayer server.

## Raise-to examples (BB = 100)

- No prior wager on a postflop street: minimum BET-to is 100.
- A bet of 100 followed by a full raise: minimum RAISE-to is 200.
- A full raise to 300 after the previous bet of 100: next minimum RAISE-to is 500 (raise increment 200).
- A player with only 150 chips facing a 100 bet may go all-in to 150 as a **short raise**, but this does not reopen raising for players who have already acted.
- A full raise resets other eligible players' acted flags and permits a new raise.
- An already-acted player facing a short all-in can CALL or FOLD, but cannot RAISE until action has been reopened.
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

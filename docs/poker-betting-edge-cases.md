# Betting-round edge cases — development checklist

Scope: virtual-chip 2–6 player no-limit Hold'em demo. This is a rules hardening step, not multiplayer/server authorization.

## Current fix
A betting round should not ask a player to check or bet when all other surviving players are all-in and the only remaining actionable player has already matched the current bet. Likewise, an all-in table has no actor. The engine now computes `toAct: null` for these situations both when creating a round and when beginning a new street.

## Manual scenarios to verify in Preview

1. **All opponents all-in, no outstanding call:** Last active player has matched the highest street commitment. Expect `toAct = null`; no pointless CHECK prompt.
2. **All opponents all-in, outstanding call:** Last active player owes chips. Expect their turn to remain available; CALL or FOLD is possible.
3. **All players all-in:** Expect `toAct = null` and remaining community cards to be revealed without further betting.
4. **Two or more players with chips:** Normal action order remains clockwise; CHECK/CALL/FOLD/RAISE remain possible.
5. **Short all-in raise:** Previously acted players can call the additional amount, but a sub-minimum all-in does not reopen their raise rights.
6. **Full raise:** Resets other actionable players' `acted` flags; subsequent calls or legal re-raises are allowed.
7. **Conservation:** Sum of all remaining stacks plus all committed chips must remain equal to the starting chip total.
8. **Side pots:** Distinct all-in stack sizes create separate eligible pots; no folded player receives an award.

## Follow-up work
Build automated betting-rule test coverage and fully integrate server-owned state transitions before opening real multiplayer. Current browser demo remains illustrative, not a production-authoritative poker game.

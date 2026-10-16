# Server tournament hand continuation

Opt in with `new SeatedHandRoom(startingStack, trustedTerms, {tournament:true, ...clockPolicy})`. Default rooms remain single-hand. This implements in-process tournament progression only; the existing browser demo is unchanged.

## Start and settlement

Initial authenticated seating/readiness is unchanged. Use the fixed six physical seat IDs in clockwise order, including vacant seats. Initial positions are computed from occupied seats and the chosen occupied button. Every hand privately deals to current live players only; custom physical order/positions are trusted server configuration, never player action fields.

After manual or timeout settlement (including forced all-in runout during hand creation), apply the existing `finishTournamentHand` accounting once per hand ID. Payouts are included before checking for zero stacks. Persist local elimination order using starting stacks and the configured BB-ante comparison basis. Equal comparison stacks retain tied place ranges. Duplicate callbacks/replays/snapshots do not create more elimination entries or reapply winnings.

Snapshots include mode, hand number and a copied `tournament` outcome containing last settled stacks, live IDs, eliminated places and champion. During the next hand, this outcome remains LAST SETTLED accounting; use `hand.players` for current stacks/contributions. Its stacks plus pot must not be mixed with current hand accounting. All returned outcome maps/history entries are independent copies.

## Starting the next hand

Only a trusted scheduler calls `nextHand(expectedPreviousHandId, trustedTerms?)`:

- Tournament mode, a current completed hand, matching previous hand ID and at least two survivors are required. Early, stale and repeated start requests reject without changing the hand or chip state. Invalid new terms fail before replacing the completed hand.
- Carry only final positive stacks into the new hand. No refill, re-entry or mid-tournament replacement is permitted.
- Advance BB clockwise to the next survivor, preserving the old physical SB/button markers rather than compacting seats. A vacant SB is not charged. On entering heads-up, BB advances first and the other survivor becomes BTN/SB; preflop starts at BTN/SB, postflop at BB. Physical button order remains available for odd-chip settlement.
- New hand gets a fresh random ID and revision 0, plus a new server turn deadline. Current connection credentials remain valid for the room. Old hand commands, receipts and timeout callbacks cannot mutate the new hand. Old accepted actions are rejected as wrong-hand after replacement rather than acknowledged from a discarded owner.
- Disconnected surviving seats remain participants and pay forced bets; their server deadline can check/fold them. Do not skip offline seats to avoid blinds. Initial readiness still requires everyone connected.
- Trusted terms may change only at this new-hand boundary. Current hand terms remain frozen. This coordinator does not yet own the tournament schedule or decide whether a break/registration window allows starting; a future trusted scheduler must provide validated terms and enforce break/start conditions.

## Eliminated members and completion

An eliminated member keeps their reserved membership until leaving. Reconnecting them rotates their room connection normally, but personal snapshots of later hands use the spectator projection: no new own cards, no legal actions, no forced bets, no identity spoofing. They may follow the remaining table. Live survivors cannot leave/release a seat between hands; they may disconnect while the seat remains reserved. No replacement can join after initial start. After a champion is determined, the room phase is `finished`, the turn deadline is null and all further next/start requests reject. Local standings remain available. No official results, prizes, re-entry or wallet writes are performed.

## Integration boundaries

No autonomous scheduler, WebSocket transport, real credential validation, durable crash recovery, multiple tables, table movement or Railway resources are created. An exclusive owner/shared atomic state+receipt transaction is still needed across replicas. Later persistence must atomically store settlement, elimination, carried stacks, new hand ID and deadline before durable acknowledgement. A browser must receive only the room's personalized/public projection, never a private owner/deal.

Railway remains deferred until all development completes. This stage is internal and needs no manual UI check.

## Verification

12 new tests (157 regressions total) cover chip carryover, early/stale/duplicate next requests, dead button/vacant SB server dealing and settlement, heads-up positions, eliminated reconnect privacy, post-award elimination, invalid/changed terms, retired action/timer isolation, copied and stable rankings, reserved/offline seats and champion termination. 20 deterministic full six-to-one server tournaments verify no re-entry/refill and total-chip conservation across every hand. The older 100 single-hand simulations, 100 connection rotations, 42 isolated PostgreSQL checks and 2 React lifecycle tests remain in CI.

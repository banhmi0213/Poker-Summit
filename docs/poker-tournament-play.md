# Tournament setting integration: local six-seat demo

The tournament demo now initializes all seats with structure.startingStack and freezes the level, SB/BB and ante at each hand's shuffle request. A level change during play does not mutate that hand. Scheduled start and breaks prohibit new hands; existing hands can finish during a break. Final configured level continues. The clock and applied-hand terms are shown separately.

## Forced bets and settlement
- BBA posts the BB first, then as much ante as remains (2026 TDA RP-11).
- All-player antes are deducted before blinds. Ante payments never count as street-call credit.
- BBA is common main-pot money: keep its amount in totalCommitted for conservation/refunds but exclude sharedAnte from per-player matching thresholds. Add it to the main pot before splitting, including odd chips.
- Individual partial antes retain the payer's matching cap. Short-blind preflop brings in the full configured BB if multiple players can still bet. A sole remaining actor only needs to match live all-in opponents.
- All forced-bet all-ins can start with no actor and run out automatically. Snapshot metadata survives street transitions without charging again.
- Unfinished demo resets refund each player's own contributions; completed hands carry awards once. Ring demos retain the announced refill behavior. Tournament demos never automatically inject replacement chips. Zero-stack seats are now eliminated after payouts; see poker-tournament-elimination.md for dead-button progression, reduced rosters, HU and champion termination.

## Scope
This is still a browser-local demo with five dummy opponents and all dealt cards in its client payload. It is not a synchronized online tournament. No registration, re-entry, member wallet, tournament result or prize payout writes. Reload starts a fresh local demo. Admin/store permissions and saved configuration remain unchanged. No database migration is required.

## Preview review
`/poker-demo?game=tournament&pace=fast`: 10,000 starting chips each, 1-minute levels 50/100/100 BBA, 75/150/150 BBA, 1-minute break, then 100/200/200 BBA continuing. Initial POT is 250 (SB 50 + BB 100 + BBA 100). Your initial SB stack is 9,950; BB's is 9,800. At level change the displayed current hand stays fixed; next hand/reset applies the new limits. During the break next-hand/reset is disabled; current hand actions continue.

Add `&ante=per-player` to use all-player ante instead: initial POT 750 (six antes of 100 plus 150 blinds), SB stack 9,850 and BB stack 9,800. Debug pace/mode only affect sample settings in Preview/development, not saved tournaments or production.

Verify regular `/poker-demo` still uses ring settings 50/100 with the original stacks. A published tournament-specific URL uses its actual saved stack, schedule, ante and start time.

## Validation
93 Node tests pass, including 17 forced-bet/clock/settlement tests and two real-component initial-render checks; the suite also includes 300 seeded multi-street simulations verifying chip conservation across 2-6 seats, ante formats, folds, raises and all-ins. Changed paths have no TypeScript diagnostics; full project tsc still has unrelated existing errors. Browser interactions and visual layout require Preview review.

## Rule references
- New limits apply to the next hand: TDA 2026 Rule 25, https://www.pokertda.com/view-poker-tda-rules/
- BB-first BBA recommendation: TDA 2026 RP-11 (JOPT translation), https://japanopenpoker.com/rule/pokertda2026v1/

The following elimination stage expands the regression suite to 109 Node cases plus 2 component lifecycle scenarios; details and new review presets are in [poker-tournament-elimination.md](poker-tournament-elimination.md).

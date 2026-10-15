# Random cards in the local poker demo

## Behavior
- The initial authenticated/Preview page creates a deal on the server. Next-hand/reset requests use a Server Action with the same production login gate; Preview/development retains guest access.
- Use the existing node:crypto randomInt Fisher–Yates shuffle and 52-card engine. Deal clockwise starting left of BTN, one card per seat twice, then burn/flop(3), burn/turn(1), burn/river(1).
- Send only the dealt board and hole cards, not the unused deck or burns. Reveal the board in the existing betting sequence. Opponents are face-down until showdown; folded hands remain hidden in the UI.
- Format cards and role names from the same seven-card evaluator used by payout settlement. Aces can be low for a five-high straight; suits do not decide ties.
- A completed hand carries stacks plus payouts forward. Resetting an unfinished local demo returns commitments before taking new blinds. Demo refill resets all seats if a seat reaches zero and explicitly announces this.
- Disable actions while awaiting a deal. A failed request preserves the current deal and chip state and permits retry.

## Scope boundary
This is a single-user simulation, NOT an authoritative multiplayer implementation. All dealt opponent cards and the future board are present in the demo client's payload. Visual concealment is not privacy against developer tools. Do not reuse DemoDeal or the Server Action for competitive multiplayer; that requires server-owned action state, per-user private snapshots and timed board publication. No wallets or database writes are added.

## Validation
`npm run test:poker` covers existing betting tests plus deck uniqueness, shuffle permutation/immutability, two-pass dealing, button-relative/headsup dealing, exact burn/board order, hand category order, ace-low straight, using 0/1/2 hole cards, highest full house, kickers, suit ties, label/settlement consistency, and preflop UI card rendering.

Local full build initially failed while prerendering existing /terms and /tokushoho because this workspace has no Supabase URL. Use Vercel Preview's configured environment for the complete deployment build; do not change unrelated legal pages to bypass their configuration.

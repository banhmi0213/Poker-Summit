# Online table using the approved layout

`/poker-online/[roomId]` now reuses the approved demo's portrait felt, responsive
three-column desktop shell, header and expandable mobile site navigation.
`/poker-demo` and its styles/components have not been modified. The authenticated
online route still needs deliberate backend configuration and assigned users;
there is no anonymous playing route or browser-owned deal fallback.

## Projection and controls

`online-table-view.tsx` renders server cards, stacks, commitments, payouts,
positions, connected status, phases and deadlines. Physical seat IDs remain
stable when each viewer's seat rotates to the bottom. Clockwise neighbours
retain their order. Two occupied seats use opposite ends for both players and
spectators. Opponent holes stay as backs until the server explicitly provides
them; folded holes are hidden. No local shuffle or winner evaluation runs.

The public scheduled snapshot now includes a detached frozen `structure` and
`startsAt` for the desktop/sidebar and game-menu schedule. These are public
configuration only: no checkpoint, future cards, participant IDs or capabilities
are added. The current hand still displays its frozen terms while the schedule
can advance. Countdown values use the server time sample, not a local engine.
Final-level wording has its own stable row; expanding information is an overlay
and does not move the table on desktop or mobile.

Settled player stacks already include payouts and are never credited again.
The visible increase/decrease is the server payout minus that player's total
commitment (including ante). It is a display value only. No balance/prize
transfer happens here. The result panel stays visible on desktop; its two
columns keep names readable in a narrow sidebar. Tournament results/elimination
come from the existing server projection and durable result logs.

`online-controls.tsx` enables only server legal actions and validates integer
raise targets against server minimum/maximum. Shortcuts only select an amount;
they do not submit a bet. A server-sampled expired turn, pending request or
unknown action result disables betting. Reconnect and exact-receipt retry keep
the existing transport rules. No unsupported time bank, action reservation,
manual deal/next-street, reset, refill or simulated-opponent controls are shown.
Sound preferences and server-provided hand-rank labels remain separate work.

Explicit exit confirms and waits for current-capability disconnect before
navigation; it does not cash out or abandon tournament standings. Unknown action
results must be reconciled first. Spectating disconnects the player capability
before a public read and continues public polling. Authentication, room or
availability changes clear the previous projection and action state. Other site
links still navigate normally; HTTP-only tab-close presence remains a transport
limitation until the configured push connection is used.

## Verification

Node tests cover all viewer rotations, heads-up spectators, frozen configuration
cloning, unchanged settled totals, ante-aware zero-sum displayed deltas and
server-sampled deadlines. Actual React lifecycle tests cover raise selection,
menu state, sign-out, uncertain actions/exit, disconnect acknowledgement,
room changes, spectator hand hiding and mobile navigation. Existing transport,
engine and database regressions continue to run in CI.

`tests/poker-online-browser.cjs` is optional local layout QA. It statically
renders the real table, controls and navigation components with source CSS and
fixture snapshots. CSS module names are mapped for this isolated renderer.
It requires `POKER_CHROMIUM_MODULE`, `POKER_PLAYWRIGHT_MODULE` and optionally a
local Japanese font in `POKER_UI_FONT_FILE`; screenshots go to
`POKER_UI_SCREENSHOT_DIR` (default `/tmp/poker-ui-visual`). No test route,
credential or production deployment is created.

Eleven browser scenarios cover 320/390px mobile and 1024/1280/1440px desktop,
showdown, heads-up, different blind positions and final-level text. Assertions
check horizontal overflow, desktop page scrolling, card-vs-avatar/badge/bet
intersections and stable table bounds when tournament information opens.
This is rendered layout QA, not an authenticated multi-browser live-game test;
that and final deployed visual approval follow configured test infrastructure.
No production merge, database application or Railway change is made here.

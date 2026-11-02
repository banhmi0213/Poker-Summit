# PC community panel and shared Summit chip balance

The PC poker demo and authenticated online table provide a `サミットを同期` toggle. At 1980px and wider, the panel occupies the right margin outside the unchanged 1380px game area. Narrower PC screens use a closable floating panel on the left, keeping action controls accessible. The wrapper uses display:contents so opening/closing never changes the table width, height or flex sizing. Smaller screens omit the panel. Opening it mounts `/poker-community` on the same origin. Closing it stops polling without remounting the game.

The panel lists the latest 30 visible board threads and up to 50 latest visible replies to the selected thread. It polls every 15 seconds, supports explicit refresh, and renders text safely. Submitting is an explicit user action. `/api/poker/community` verifies the session and suspension status, enforces same-origin JSON writes and size limits, derives author identity from the session, and applies existing board RLS. Stable message IDs allow an explicit retry after a lost acknowledgement without inserting a duplicate. Inputs stay locked until an uncertain submission is resolved.

`SummitChipBalance` uses authenticated `poker_ring_balance()` in the ring lobby, My Page and PC game rail. It displays total available plus in-play wallet chips, not tournament/demo stacks. The migration creates missing wallets at zero, preserves existing balances and provides no client balance-writing capability. Initial two staging members have zero wallet balances. Reads refresh every 15 seconds and on window focus; failed reads show an error rather than a fabricated zero. Actual ring buy-in/settlement remains separate future work.

## Staging setup

Apply `supabase/migrations/20261019081323_poker_ring_balance.sql` after the statistics schema. `db/staging/poker_board_foundation.sql` is ONLY for the isolated staging project, which lacked board tables. Never apply this foundation to production, where those tables already exist. No production posts were copied and no live test posts were sent.

## Verification

- Poker automated tests: 410 passed.
- React lifecycle tests: 34 passed, including shared balance refresh and sign-out clearing.
- Isolated PGlite SQL checks: balance preservation, initial zero, ranks, anonymous denial, no client wallet updates, board author ownership and hidden thread/reply access.
- Chromium isolated HTTP fixture: desktop panel opens, submits one fixture thread, opens reply view; mobile panel omitted. No real messages sent.
- New staging schema: 2 wallets, both zero; anonymous balance execution and direct authenticated wallet updates denied.

User verification: reload staging, compare ring lobby and My Page balances; open the PC game panel and manually post/reply; check a second signed-in browser receives the update within 15 seconds. Staging posts are separate from the production board. Production rollout requires the normal release step.

The lobby/account header and all face-down player cards share the official `/images/summit-finger-clean.webp` mark. Cosmetic card-back background/border tokens allow future approved themes; paid entitlement, theme selection and persistence are not implemented by this cosmetic change.

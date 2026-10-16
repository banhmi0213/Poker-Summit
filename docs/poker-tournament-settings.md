# Tournament configuration, clock and structure UI

## Implemented
- New, separate admin/store menu: /admin/poker-tournaments and /store/profile/poker-tournaments. Existing physical-store events are not rewritten.
- Title, organizer store (admin may choose Summit), JST start, initial stack, level-specific SB/BB/ante/minutes, BBA/per-player/none, late-reg closing level, re-entry allowance, breaks, color-up notes, image upload/removal and draft/public state.
- Shared forms, server-side validation, independent action auth checks, owner-scoped updates under RLS, 2MB PNG/JPEG/WebP signature checks, cleanup of newly uploaded files if saving fails.
- Published settings appear in poker-lobby. Linked poker-demo pages show a start-time-based clock and game-menu structure table; sample: /poker-demo?game=tournament.
- Unsaved editor preview: /poker-tournaments/preview. No database writes.

## Database
Migration supabase/migrations/20261015173721_poker_tournament_settings.sql was applied to poker-summit (tjmeqnzvuoguoffltxrp), with existing public.stores UUID IDs, public.is_admin(), public.is_suspended(), and storage/auth schemas. It adds poker_tournaments and the poker-tournament-images bucket, JSON validation constraints, RLS and indexes; no existing events or balances are deleted.

Supabase connectivity became available and the live project/schema were inspected. Applied migration version 20261015173721. Enabled RLS, explicit Data API grants and the 2MB public PNG/JPEG/WebP image bucket. Owner/admin rules are combined per command; identity functions are cached per statement. Existing unrelated data/policies were not rewritten.

Live transaction test passed 10 assertions: owner insert/update, draft privacy, other-owner read/write restrictions, publication/unpublication, and admin insert/update. All test rows were rolled back; final poker_tournaments row count was zero. New-table security advisor findings: none. New indexes naturally report unused before traffic. Actual browser login/form submission and binary Storage API uploads remain manual verification items; SQL metadata/RLS tests do not prove those complete.

## Verification
- npm run test:poker includes clock boundaries, reload/background catchup, breaks, late registration (including breaks before the cutoff), final-level continuation, numeric limits and rendered timer/structure.
- Optional isolated PostgreSQL check: POKER_PGLITE_MODULE=/tmp/poker-sql-check/node_modules/@electric-sql/pglite node db/tests/poker_tournaments_isolated.cjs. Installs PGlite separately; not a production connection. 23 migration/schema/RLS/storage assertions passed. Identity helpers are test stubs, so live table RLS was additionally verified with real project helpers and rollback-only writes.
- Project-wide tsc reports pre-existing unrelated errors; review changed-path diagnostics. Local build lacks Supabase env for existing terms/tokushoho prerender; Vercel configured build is the deployment check.

## Deliberate execution boundary
Publishing is currently publication of tournament SETTINGS, not enabling real player registration or running a tournament. The existing local poker demo remains 50/100 and no ante, explicitly stated beside the clock. Scheduled blind values/antes are not charged to players yet. No chips/wallets/registration rows are written.

A multiplayer-authoritative tournament controller must later snapshot the current level at hand start, apply changes only to the next hand, enforce late-reg/re-entry on the server, implement ante accounting separately from street calls, bust-outs/dead button/table balancing, synchronized pause/resume and persistence. Do not present the current browser clock as that authority. Color-up is an informational schedule note, not an automated chip race.

Reference: https://www.pokertda.com/view-poker-tda-rules/ — New Hand / New Betting Limits; new limits apply to the next hand (accessed 2026-10-16 JST). Stack-depth and speed suggestions are editable organizer choices, not universal required limits.

## Review flow
1. Open /poker-demo?game=tournament: clock above table; game menu > Structure.
2. Open /poker-tournaments/preview: change stack/levels/ante/breaks, apply to the unsaved clock.
3. After live migration: admin can create Summit/store records; store can edit its own records only; draft is absent from lobby, published visible.
4. Save/reload structure and image; replace/remove image, unpublish. Test other-store changes are rejected and failed upload/save preserves current record.

## Organizer/prize extension
Migration 20261015175743 was applied to the same project. Adds optional public organizer_name (200 chars) and typed prizes (unique ranks, chips 1..1e9 or required text). Ownership remains controlled solely by owner_store_id and existing RLS. No wallet, payout or tournament-result writes are implemented. The project currently has no member-chip wallet table; store_spot_credits is a separate advertising credit product and must not be used for prizes.

Uploaded images render at 16% opacity behind clock/structure information, at 25% in lobby/form previews. The generic game=tournament sample has no saved image; open a published tournament using its tournament UUID or the manager's table link. Added runtime tests cover prize validation and rendering. Live rollback checks verified JSON constraints and organizer/prize persistence without altering existing records. 64 engine/config/render tests passed. Manual browser appearance and form submission remain review steps.

Numeric editing uses centered manual inputs and 44px minus/plus buttons: chip amounts move by 10, duration by 1, ordinal rank/late-reg level by 1. Off-grid values such as 75 remain valid. Buttons clamp to existing limits, do not submit, and disable for break/none-ante fields. Narrow mobile screens render structure rows as labeled cards without horizontal scrolling; desktop retains a scrollable table. Regression tests cover arithmetic, bounds, disabled state, keyboard input and editor labels.

## Store authorization (default deny)
Migration 20261016071559 adds poker_tournament_store_access. No initial permission rows are inserted: all stores start disabled. The admin tournament page links to /admin/poker-tournaments/access, which searches all stores in paginated 30-row results and permits explicit grant/revoke. The store sidebar greys out only the online tournament item; direct URLs render disabled forms and server actions recheck both selected and existing-record ownership/permission. Lookup errors fail closed. Permissions do not affect the normal event, coupon, job or store profile features.

Admin-only RLS protects permission writes. Restrictive policies gate tournament inserts and both old/new states of updates, so revocation blocks already-open clients. Storage paths for new uploads include user/store IDs; permission checks bind images to the exact store (legacy paths require an existing matching tournament). Existing tournament data, images and publication remain intact on revocation; admins can continue managing all tournaments. No store has been granted access automatically.

Verification: 74 Node regression tests; isolated PostgreSQL 42 schema/RLS/storage assertions covering self-grant rejection, exact-store ownership, multiple stores for one user, revoke, legacy images and suspension. Live project rollback-only transaction passed 11 assertions with real owner/admin helpers, preserving existing rows and leaving zero permission/test rows. GitHub Actions now runs isolated PostgreSQL tests using pinned PGlite 0.5.10.

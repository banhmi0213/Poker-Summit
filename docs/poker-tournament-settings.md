# Tournament configuration, clock and structure UI

## Implemented
- New, separate admin/store menu: /admin/poker-tournaments and /store/profile/poker-tournaments. Existing physical-store events are not rewritten.
- Title, organizer store (admin may choose Summit), JST start, initial stack, level-specific SB/BB/ante/minutes, BBA/per-player/none, late-reg closing level, re-entry allowance, breaks, color-up notes, image upload/removal and draft/public state.
- Shared forms, server-side validation, independent action auth checks, owner-scoped updates under RLS, 2MB PNG/JPEG/WebP signature checks, cleanup of newly uploaded files if saving fails.
- Published settings appear in poker-lobby. Linked poker-demo pages show a start-time-based clock and game-menu structure table; sample: /poker-demo?game=tournament.
- Unsaved editor preview: /poker-tournaments/preview. No database writes.

## Database
Apply supabase/migrations/20261016180000_poker_tournament_settings.sql only after verifying the live project and existing public.stores UUID IDs, public.is_admin(), public.is_suspended(), and storage/auth schemas. It adds poker_tournaments and the poker-tournament-images bucket, JSON validation constraints, RLS and indexes; no existing events or balances are deleted.

The migration has NOT been applied to the live project in this session. The Supabase plugin installation was confirmed, but no project/SQL callable tools were exposed to the active runtime. Do not mark live storage/save tests complete until access is available.

## Verification
- npm run test:poker includes clock boundaries, reload/background catchup, breaks, late registration (including breaks before the cutoff), final-level continuation, numeric limits and rendered timer/structure.
- Optional isolated PostgreSQL check: POKER_PGLITE_MODULE=/tmp/poker-sql-check/node_modules/@electric-sql/pglite node db/tests/poker_tournaments_isolated.cjs. Installs PGlite separately; not a production connection. 23 migration/schema/RLS/storage assertions passed. Identity helpers are test stubs, so live policies still need verification against the real schema.
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

# Poker Summit Online Poker — Phase 1 technical design

Status: proposal / UI preview only. **No production game, real-time networking, chip wallet, or database migration is included in this PR.**

## Existing repository inspection (main, 2026-10-14)
- Next.js 14 App Router, React 18, TypeScript, Vercel (`package.json`, `app/layout.tsx`).
- Supabase Auth uses `@supabase/ssr` cookie-backed server client (`lib/supabase/server.ts`).
- Shared site header is `app/portal-header.tsx`; site-wide middleware refreshes Supabase sessions (`middleware.ts`).
- Existing pages use `createClient().auth.getUser()` for user identity.
- No existing game server / Socket.IO / Redis dependency in `package.json`.
- This inspection does **not** establish current Supabase schema, RLS policies, production capacity, or Vercel environment configuration; verify before implementing DB changes.

## Preview scope
- Route: `/poker-demo` (unlinked from global navigation; `robots: noindex,nofollow`).
- Mobile-first blue oval table, five opponent placeholders + YOU, community cards, pot, two hole cards, slider and action controls.
- UI actions are **local-only mock interactions**. Cards, names and stacks are fixed sample data. No betting or random generation occurs.
- Existing pages and existing DB are unchanged. Preview route is not a protected beta game; **do not store real user data or secrets in it**.

## Target architecture (future phases)
Browser (Next.js UI) <-> authenticated WebSocket gateway (standalone Node.js/TypeScript service) <-> authoritative per-table engine. Supabase Auth validates identity; DB holds beta permissions, wallets and audited hand history. Redis provides recoverable snapshots/coordination; Postgres is the durable source for chip accounting. Do not rely on client-side game state for money/chip authority.

## Security and correctness invariants
1. Free virtual chips only: no payment, transfer, cash-out, prizes or exchange.
2. Server-side CSPRNG with unbiased Fisher–Yates shuffle; send private hole cards only to the owning authenticated connection.
3. Server authoritatively validates turn, bet size, stack, action sequence and idempotency key.
4. Pot settlement includes ties, side pots, odd chips and heads-up rules; test with deterministic fixtures.
5. Wallet refills and table buy-ins/cash-outs use atomic transactions, ledger entries and idempotency; preserve total chips across crash/reconnect.
6. Seat ownership, invite permission, rate limits and reconnect tokens checked server-side. Never trust a browser's player ID.
7. Do not enable public access to real game routes until authorization, RLS, staging isolation and load/security tests pass.

## Planned DB migration (NOT applied)
- `poker_beta_members(user_id PK FK auth.users, status, invited_at, invited_by)`
- `poker_players(user_id PK FK auth.users, display_name, created_at)`
- `poker_wallets(user_id PK, balance bigint CHECK(balance >= 0), version bigint)`
- `poker_chip_transactions(id PK, user_id, delta bigint, reason, reference_id UNIQUE, created_at)`
- `poker_tables(id PK, status, max_seats CHECK(max_seats = 6), blinds, created_at)`
- `poker_seats(table_id, seat_no, user_id, stack, UNIQUE(table_id,seat_no), UNIQUE(user_id) where seated)`
- `poker_hands(id PK, table_id, hand_no, started_at, ended_at, status)`
- `poker_hand_actions(id PK, hand_id, actor_id, sequence, action, amount, idempotency_key UNIQUE)`
- `poker_hand_results(hand_id, user_id, net_chips, rank)`
- `poker_refill_logs(id PK, user_id, amount, created_at, idempotency_key UNIQUE)`

RLS: no client INSERT/UPDATE to balances, transactions, hands or actions; game server uses least-privileged server-only credentials. Invite state is not editable by ordinary members. Draft exact SQL only after inspecting real migrations and naming conventions.

## Phase 1 acceptance checklist
- [ ] Preview page renders at 360px, 390px and desktop widths.
- [ ] Action controls and raise slider respond locally; labels explicitly say demo.
- [ ] No links added to existing navigation; no existing page modifications.
- [ ] No Supabase writes or WebSocket calls from demo.
- [ ] `npm run build` passes on Vercel Preview.
- [ ] Product owner approves UI before merging.

## Next tasks (separate PRs)
1. Confirm Supabase schema and invitation/admin roles; design migrations + RLS.
2. Implement authenticated invite-gated lobby and wallet ledger in staging.
3. Build isolated, unit-tested poker engine (state machine, hand evaluator, side pots, CSPRNG).
4. Introduce standalone WebSocket server and authoritative table actors; reconnect recovery.
5. Integration, abuse testing, load testing and closed beta release.

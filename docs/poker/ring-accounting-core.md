# Ring accounting core (staging only)

The wallet now has a server-only accounting path from funding reservation to a settled hand and final-stack cashout. No new ring route, public buy-in button or Railway runtime has been enabled. Existing tournament routing is unchanged.

## States and conservation

A reservation moves from `held` to `seated` to `returned`, or directly from `held` to `returned` when cancelled/expired. Seated stacks can be zero after a lost all-in. Wallet `in_play` equals the seated stack; each member has at most one open hold/seat. A 1,000-chip buy-in can cash out more or less than 1,000 after play. The original reservation refund RPC cannot refund seated funds.

A hand binds all seated members, seat numbers, initial stacks, blinds and button. One active hand is allowed per table. Membership and table configuration cannot change during that hand. This first core admits changes only between hands; public dead-button/blind-entry rules remain to be finalized with the scheduler.

`ring_hand_begin` stores an AES-GCM encrypted checkpoint. `ring_hand_write` uses expected-version CAS and an immutable write receipt. A terminal write atomically saves the encrypted final hand, validates an exact participant list and unchanged total chips, updates every member's in-play balance/stack, records per-member settlement deltas and marks the hand complete. Any invalid participant, negative/fractional stack, changed total, stale version or conflicting receipt aborts the whole transaction. Requests require service_role; clients cannot submit a result or select their identity through these RPCs.

All money/seat operations lock the table before accounts. Multi-account settlement locks accounts in UUID order. The member wallet itself has no table lock. Reservations and seated funds both block stake/capacity/publication/removal changes. Expiry releases only unseated holds and is idempotent; disconnect must never call this to return a seated stack.

## Server coordinator

`RingHandOwner` composes the existing authoritative poker engine with `SupabaseRingStore`. It derives seats and amounts from the database, hides opponents' cards and member IDs from projections, and creates ring-specific encrypted checkpoints bound to hand UUID/version. It only acknowledges a mutation after storage succeeds and reloading validates the checkpoint against accounting. A lost response freezes further actions/projections; retry uses exactly the same write ID and ciphertext. Restore keeps the original cards and action receipts. Competing writes are fenced by expected-version CAS.

This is an internal coordinator, not a running multiplayer room. It still needs admission/auth routing, exclusive live owner/session capabilities, durable turn deadlines, disconnection policy, automatic recovery/discovery, next-hand scheduling, recurring hold cleanup and a lobby/table UI. CAS prevents competing financial writes; it is not a substitute for the live transport's ownership and session fencing. Do not expose this class directly through an unauthenticated endpoint.

Retain encryption keys for all unfinished hands; losing a key cannot safely be fixed by re-dealing or returning the original buy-in. Recovery must stop and report the affected hand. A suspended member may still receive a legitimate cashout.

## Validation

- `npm run test:poker`: existing suite plus ring privacy, invalid actions, failures before/after commit, exact retries, restored cards, competing owners, tamper/wrong-key/version/accounting rejection and wallet settlement/cashout parsing.
- `POKER_PGLITE_MODULE=<isolated pglite package> node db/tests/poker_ring_accounting_isolated.cjs`: disposable PostgreSQL with pgcrypto, actual migrations, both rollback SQL scripts and the actual engine/coordinator/store. Covers two-player and unequal 1k/2k/3k three-player all-ins, durable restore, lost acknowledgement, side-pot accounting conservation and cashout.
- `tests/sql/poker-ring-accounting.sql`: rollback-only test against the separate Supabase staging project. No real account/table balances are altered.
- GitHub Actions runs the isolated accounting check on relevant PRs.

These tests are not a live multi-account ring UI test or a multi-connection PostgreSQL load test. Production has not been migrated or released by this follow-up.

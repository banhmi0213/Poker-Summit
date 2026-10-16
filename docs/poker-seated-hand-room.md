# Authenticated seating and connection ownership preparation

`SeatedHandRoom` wraps the current `AuthoritativeHand` with a six-seat lobby and current connection ownership. It does not create a WebSocket service, authenticate users, persist state or alter the existing browser demo. A trusted scheduler can now invoke its deadline callback (see `poker-turn-deadlines.md`). `authenticatedMemberId` must come from a verified transport session, never a request-selected account ID.

## Lifecycle

1. Trusted server policy supplies starting stack and hand terms. `seat(member, seatNumber)` reserves one vacant physical seat (1-6). A member may hold one seat per room; duplicate member/seat requests are rejected. Starting stack is fixed room policy, never supplied by an action or seating request. Totals across six seats must remain safe integers.
2. `connect(member)` requires an existing seat and issues a random per-connection UUID plus that member's snapshot. Return this response ONLY to that authenticated socket. Every reconnect rotates the token, retiring the previous socket. Public projections contain canonical `seat-N` IDs, occupancy/connection flags and redacted hand state, not account IDs or connection tokens.
3. A trusted scheduler calls `startHand(buttonSeat)` once, with an occupied button and at least two seated players, ALL connected. Do not expose this scheduling method as an unrestricted player command. Physical seats are sorted clockwise; unused seats are not charged or dealt. Constructing the hand validates terms and applies forced bets before committing the room state. Repeated starts cannot redeal or charge a second time.
4. `act(member, connectionId, payload)` derives the actor seat from server membership and verifies current connection ownership before invoking the strict hand command protocol. No player-selected actor/stack/deck field is accepted. Commands still use HAND revision; ROOM revision tracks seating/presence/start and newly accepted actions. Replays do not increment either revision again.
5. `disconnect(member, connectionId)` retires that token only. It preserves the seat, current turn, all private cards, stacks and hand version. A new connect retrieves the same live hand with a new token. Stale disconnect callbacks must be caught/ignored by the future transport; they cannot mark a replacement socket disconnected.
6. `leave(member, connectionId)` frees the seat only before the hand starts or after settlement. It retires the connection. Live-hand seat release/replacement/refunds are rejected, so a client cannot erase commitments by leaving. A disconnected live seat remains reserved. The original turn deadline remains in force. The trusted scheduler may now check/fold the actor on expiry even when disconnected; reconnect does not reset it.

By default this remains a SINGLE-HAND room. Opt-in `{tournament:true}` enables the trusted `nextHand(previousHandId, terms?)` coordinator, carried stacks, physical dead-button positions, post-award elimination and champion termination (see `poker-server-tournaments.md`). Tournament survivors cannot release their reserved seat between hands; busted players may leave or reconnect as spectators. Initial start and new seating still cannot be repeated. No wallet debit/credit or prize delivery occurs.

## Integration boundaries

- A real endpoint must validate Supabase/Auth credentials and map the member to this room on the server. Passing a user-controlled account ID would defeat the model. No new endpoint or credential handling is introduced in this PR.
- These tokens bind live connections, not long-lived login credentials. Do not broadcast or log them; durable session-token handling is a separate transport/storage design.
- Per-room synchronous methods are atomic only in the SAME owner process. Use exclusive ownership or transactional shared storage for seat reservation, connection rotation, hand state and receipts across replicas. Never run independent in-memory rooms for the same table on separate instances.
- Reconnect works while this owner is alive. Process restart/crash recovery is not implemented. Persist state and accepted receipts atomically before durable acknowledgements in a future store.
- Room revisions describe latest presence + hand state, and can help a future transport discard reordered snapshots. They are not a durable global sequence.
- Viewer selection is fixed by authenticated membership and connection; spectators call `publicSnapshot()` and never choose a private seat.
- No heartbeat detection, network scheduler/broadcasts, rate limits, match-making, mid-hand replacement, late registration, re-entry or official results storage is claimed.

Railway resources/deployment remain deferred until development is complete, per the user's instruction. There is no UI change or manual screen test for this stage.

## Verification

12 room regressions cover duplicate seating, strict readiness, sparse physical seat order, hidden identities/tokens, cross-member token abuse, payload actor/stack spoofing, waiting/post-hand leave, live seat locks, repeated start, exactly-once retry after reconnection and 100 session rotations with stale-token rejection. Earlier 121 regressions remain, plus 12 deadline regressions (157 total); CI also runs 42 isolated SQL policy checks and 2 React demo lifecycle tests.

Recovery primitives and the prepared, unapplied database migration are documented in
[poker-room-persistence.md](./poker-room-persistence.md). Persistence is not wired to a running server.

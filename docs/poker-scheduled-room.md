# Server schedule and room integration

`ScheduledTournamentRoom` is the server-owned schedule boundary around an opt-in tournament `SeatedHandRoom`. Its private room cannot be accessed by a consumer. Existing demo pages and endpoints are unchanged; this is not a running WebSocket service.

## Trusted configuration and time

Construct with trusted `{structure, starts_at}` plus optional trusted `{now, turnMs}`. Shared structure validation normalizes levels/breaks and rejects unsafe amounts, malformed periods or decreasing blinds. The wrapper explicitly copies allowed fields so unknown configuration properties cannot leak through a public clock. Input/snapshot mutations cannot change the owner. Schedule is fixed for this owner; editing a running tournament schedule is not provided.

The clock must be a nonnegative safe integer on an absolute epoch-ms timeline matching `starts_at`; a bare `performance.now()` origin is not appropriate here. Default is `Date.now`. Backward values clamp to the greatest observed time. Each public operation samples time ONCE, and the room's deadline calculations and returned clock metadata use that same sample. This avoids mismatched blinds/deadlines if reading time twice straddles a level boundary.

Snapshots include `serverNow`, current `clock` phase/period/level/countdown, next playing level, immediate `following` period (including a break), schedule registration flag, and `canStartHand`. Period objects are copied. `canStartHand` also requires the waiting room to have at least two occupied seats all connected, or a completed non-champion hand. This is an aid for scheduling, not permission to skip the underlying start/hand-ID checks.

The schedule registration flag describes configuration only: late admission/re-entry is NOT implemented. Initial seating policy remains the existing room policy, with no new seats after the first hand. Do not advertise actual registration/re-entry simply because a clock flag is true.

## Start and hand boundaries

Only trusted schedulers call `startHand(buttonSeat)` or `nextHand(previousHandId)`. Neither accepts player-provided blinds, ante amounts or timestamps. The wrapper derives forced-bet terms from current server time and validated schedule. Even a late INITIAL start uses the level currently active, rather than level 1. The lower-level room's trusted `startHandWithTerms` exists for this selection, but it must not be exposed to player endpoints as a bypass.

Before scheduled start and during a break, both operations reject before dealing, charging blinds/antes or changing the hand owner. At the exact start/break-end boundary a new hand can start. Changes in level/ante apply only at the NEXT deal; a hand in progress retains frozen terms. Next-hand commands still require the completed hand ID, preserving stale/duplicate request rejection and carried chips.

Existing actions and turn-expiry callbacks continue during breaks. A hand may finish in a break; it is then held until the break ends. The wrapper does not pause or reset action clocks for a scheduled break, because in-progress hands must finish. Disconnected participants still follow normal check/fold expiry policy. At schedule exhaustion, the last configured level remains in force; only the room's actual last-survivor condition ends the tournament.

Public and per-member snapshots, current-connection validation, hidden opponent/folded cards, receipt retries, elimination and champion state are delegated to the owner. Actions cannot include client clock/term overrides. Callback returns remain public; private updates must only go to the authenticated socket.

## Remaining boundaries

No network timer registration/broadcasts, credential validation, durable crash recovery, official results storage, wallet/prize movement, late admission/re-entry, multi-table balancing or production migration is included. A future transport must exclusively own or atomically coordinate the SCHEDULED wrapper plus room/hand/state/receipts. It must actually invoke captured timeout callbacks and schedule allowed new hands. Do not publish the raw room as an alternate command route.

Railway setup/deployment is still deferred until all development completes. No manual screen verification is needed for this internal stage.

## Validation

12 added tests bring regression count to 169. They cover exact start/level/break boundaries, late initial levels, frozen current hand, BB/per-player/no-ante charges, break actions and timeout continuation, final-level continuation, copied configuration/snapshots, invalid time/config rejection, backward/catch-up time, upcoming-break metadata, malicious timestamp/term attempts and single-sample hand/deadline consistency. Existing 20 full server tournaments, 100 hand simulations, 100 reconnect rotations, 42 SQL policy checks and 2 React lifecycle checks remain covered.

Recovery primitives and the prepared, unapplied database migration are documented in
[poker-room-persistence.md](./poker-room-persistence.md). Persistence is not wired to a running server.

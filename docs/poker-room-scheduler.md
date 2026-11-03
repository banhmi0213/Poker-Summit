# Registered readiness and durable automatic progression

Backend preparation: the timer driver is implemented and tested, but no worker/listener, existing
UI, production migration or Railway process is started. Construction/import has no background work.

## Initial deal

`registry.advance(roomId)` loads fresh backend-only control via `poker_room_control`: enabled flag,
current publication, current admitted UUIDs and the ORIGINAL expected participant count. The RPC
is service-role-only security invoker; private member identifiers never enter transport snapshots.
The new migration persists expected_count at roster provisioning. For legacy rows it conservatively
backfills capacity, not the possibly reduced admission count; reconcile partial legacy rosters before
activation. All three prepared backend migrations remain unapplied to production.

`DurableRoomOwner.advance(control)` clones the control input and queues the entire decision with
other operations/reads. At one sampled server time, the scheduled room requires: enabled, published,
start reached, no break, exactly the assigned members seated (no substitute), every member connected,
and current roster count equal to the original expected count. Two ready seats in a six-member
roster cannot post blinds. Deleting a member does not reduce the original count or silently start
the rest. Pre-game leave/disconnect requires that member to re-seat/reconnect; no substitute entry
or auto-refill is implemented. Once a hand exists, incomplete membership does not stop its existing
timeout/continuation policy.

Initial BTN is uniformly selected from occupied physical seats with node:crypto.randomInt. Later
buttons/blinds use the existing physical tournament positions. The normal player endpoint still
cannot issue start/next/timer commands. The older low-level trusted start/next methods are retained
for server operations/tests; use advance for the automatic path rather than bypassing readiness.

## One decision, then durable commit

Each invocation makes at most one mutation: initial deal, one expired check/fold, or one next deal.
Before a deadline it does nothing. A late callback does not consume multiple turns at once; a new
actor receives the existing full turn interval from actual server time. Existing hands/timeouts
continue through breaks. New deals wait for break end and use its current blind/ante level. The
final level continues until the game engine determines a champion. A champion gets no further deal.
Unpublishing prevents the initial deal but preserves already-started hand/tournament continuity;
disabling blocks this automatic path as well as player requests.

The room records completedAt once at terminal accounting, including forced-all-in completion. The
checkpoint and public projection preserve it. The default inter-hand result pause is 4000ms, with
trusted creation option handPauseMs (0–60000). It is stored with the schedule checkpoint and retained
on restart; a new runtime option cannot reset a stored pause. Older checkpoints missing completion
metadata use their saved room clock floor plus the default pause, conservatively waiting rather
than guessing an earlier end. Original turn deadlines and payouts remain unchanged.

advance returns event/changed/nextWakeAt plus public state and numeric readiness counts. It includes
no roster UUIDs, socket tokens, private holes or future board. The lower-level canStartHand projection
still describes engine/clock readiness; use the advance readiness/event for roster/pause policy.
Only changed decisions save. All results remain gated by durable commit, including new cards and
forced bets. On save uncertainty the owner halts; recovery reloads the committed original deal and
receipts rather than inventing a replacement. Readiness checks and mutations share the same FIFO,
but DB policy changes after dispatch are not atomically revoked; initial connection checks establish
Auth eligibility, not a background revalidation of every user's session/suspension each tick.

## Explicit timer driver

`RoomScheduler(registry, options)` starts only when server code calls start(roomId). Defaults:
1000ms polling and 128 registered rooms. Polling is a fallback for readiness changes; optional
wake(roomId) notifications after a connection/action can respond sooner. The driver uses the
engine-provided next wake/deadline to wake earlier than the poll interval. Wall-clock rules remain
in the engine, never accumulated timer ticks. Each room has one in-flight decision and one timer;
concurrent wakes coalesce. A callback cannot overlap a save or spin through overdue actions.

Missing/disabled/finished rooms stop their job. Directory/storage/clock errors stop and report only
the room UUID through onError; no automatic recovery/redeal is attempted. Operator recovery plus
explicit start is required. stop/close cancel future timers and ignore stale callbacks. Already
dispatched work may still finish its durable commit; stopping does not roll it back or acknowledge
an uncommitted action. A stopped/old job never rearms. Driver clocks/timers are injectable for tests.

Deployment still needs a single-process room routing/worker lifecycle (not distributed election),
startup discovery of room IDs, real admission management, network limits/timeouts and private client
delivery/reconnect integration. No actual running scheduler is deployed by this PR.

## Verification

25 new scheduler/driver regressions (273 total Node tests): partial/wrong/disconnected rosters,
exact start/pause/break/deadline boundaries, delayed/duplicate ticks, check/fold, frozen restart
pause, original deal on lost response, durable response gating, six-player tournament through
champion, timer callbacks, wake coalescing, stop/stale callback/failure and bounded driver capacity.
The extended admission SQL suite runs 84 checks (169 SQL checks overall), including actual control
RPC/ACLs, full registry dispatch and retained expected count after member deletion. CI retains two
React lifecycle tests and Preview build. No production database or real credentials are used.

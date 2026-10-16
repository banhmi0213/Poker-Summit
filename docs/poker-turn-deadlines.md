# Server turn deadlines and timeout actions

This extends the in-process `SeatedHandRoom`, without changing the existing browser demo. The server default turn budget is 20,000 ms; trusted configuration may choose 1-300,000 ms and inject a trusted integer clock. Never accept timestamps, deadlines or budgets from player requests.

## Policy and boundary

- Hand creation arms a deadline for the actual current actor. A new accepted player/timeout action arms a fresh full interval for the resulting actor, or clears the clock when settled/all-in runout leaves no actor.
- Room snapshots include a copied `turn` token: `{handId, revision, actor, expiresAt}`. Its revision is the HAND revision, not the room's presence revision. The expiry timestamp is absolute in the chosen trusted clock's domain; default `Date.now` uses epoch ms. Do not mix clocks/owners.
- `now < expiresAt` allows a new player action. `now >= expiresAt` rejects it without applying chips; a trusted scheduler resolves the timeout. Browser clocks and countdown text never decide acceptance.
- At expiry: check when the legal-action set permits a check; otherwise fold. No automatic call, bet or raise. The same policy applies whether connected or disconnected. Existing pot, side-pot, street advancement and terminal payouts remain authoritative.
- Connect/disconnect/snapshot do not reset the budget. A reconnect returns the unchanged deadline and same hand; it cannot buy extra time.
- A read-only `AuthoritativeHand.replay()` receipt lookup lets the room acknowledge an exact previously accepted command even if a later actor's deadline has passed. Such a retry changes no turn, version, chips or deadlines. Reused IDs with different payloads remain invalid. Room player commands reject the `timeout_` action-ID namespace used by trusted expiration actions.

## Scheduler contract

Capture `room.publicSnapshot().turn` when scheduling a server callback. At callback time call `room.expireTurn(capturedTurn)` from the owner process. The method checks actual current hand/revision/actor and actual internally stored deadline. Altering `capturedTurn.expiresAt` does not change the real deadline. A stale hand/version/actor callback returns `expired:false` with public state.

The method performs at most ONE check/fold. Duplicate callbacks for a completed turn are inert. If the server runs late, the next actor receives a full budget starting at server processing time, rather than an already expired deadline that would cascade through players. A manual action just before expiry retires its old callback. At/after expiry, manual new actions lose to the deadline even if they reach the owner before its scheduled callback. Accepted retries remain acknowledgeable.

Callbacks return public state only, never private holes or connection credentials. The scheduler method has no connection token because it is a trusted server operation; do NOT expose it as a client-controlled route. Stale disconnected socket callbacks cannot interfere with rotated connections.

The trusted clock must return a nonnegative safe integer with room for adding the budget. Invalid values reject before hand mutation. Backward values are clamped to the greatest observed server time. Use a consistent monotonic server clock for a live owner when possible; clamp does not make wall-clock timestamps portable across restarts. Forward clock corrections count toward elapsed time. Durable recovery must restore time policy and token atomically with hand state and receipts.

## Limits

No running network service or timer registration is shipped. A future WebSocket/owner scheduler must actually arrange and invoke these callbacks. No heartbeat detection, time-bank extensions, pause/resume, persistent crash recovery, autonomous next-hand scheduling, wallet or official result writes are added. One exclusive live owner or shared transactional CAS remains required; this alone is not multi-replica coordination.

Railway is still deferred until development completion, as requested. No production game behavior or screen changes in this stage.

## Validation

12 new tests with an injected clock cover exact expiry, early/duplicate/stale/forged callbacks, free checks vs owed folds, manual-action races, reconnect/disconnected actors, late receipt retry, late-scheduler single-step behavior, backward/invalid clocks, protected action IDs and forced all-in terminal state. All prior 133 regressions remain: 145 total. CI also retains 42 isolated PostgreSQL checks and 2 React demo lifecycle tests.

Opt-in tournament continuation now gives each new hand a fresh ID and versioned deadline. Retired callbacks and actions cannot affect the next hand. See `poker-server-tournaments.md`. Regression count is now 157.

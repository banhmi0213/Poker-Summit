# Durable room owner boundary

`DurableRoomOwner` composes the scheduled engine with encrypted checkpoint storage. This is a
backend service boundary, not an HTTP/WebSocket endpoint or running server. No production schema,
UI, wallet/prize transfer or Railway change is installed by this stage.

## Lifecycle

- `create(config, options)` creates an empty new room and commits storage version 1 with CAS.
  It never overwrites an existing room. No owner is returned until that initial save succeeds.
- `load(options)` requires an existing, decryptable checkpoint. It restores the same deal, command
  receipts, tournament accounting and deadlines; no missing/corrupt-data fallback creates a new
  game. It commits the disconnected recovery state before returning the owner. That CAS write
  fences subsequent writes from owners holding the preceding storage version.
- `recover()` is a trusted server operation, serialized with queued work. It halts access, reloads
  the committed checkpoint, commits a recovery checkpoint, then replaces the private room. All
  connections must authenticate/reconnect. A failed recovery keeps the owner halted.

Options inject a dedicated backend `RoomStore`, server-only key ring, room UUID and optional
trusted clock. `turnMs` applies only to creation: stored deadlines/policy govern restores. The
key ring is defensively copied on construction; key rotation requires a new owner with the new
active key plus retained decryption keys. Checkpoints, keys and the mutable room are never exposed
by this owner. `JSON.stringify(owner)` is `{}`. Health exposes status/storage version/queue count,
without cards or member information.

## Commit before acknowledgement

All seating, connect/disconnect, leave, initial/next-deal, betting and timeout operations use a
single FIFO promise queue. The queue also covers public/private snapshots: readers cannot observe
an in-memory mutation while its save is pending. A new connection token or private deal is not
returned until its checkpoint is committed. There is no broadcast callback inside the owner;
transport may send only after its awaited operation succeeds, respecting returned revisions.

An accepted duplicate betting command returns its already-durable receipt without another save.
Early/stale timeout callbacks are also read-only. Invalid commands reject without poisoning the
queue. If an unexpected failed operation changes checkpoint state, access halts. Payloads and
captured deadlines are cloned at enqueue time, so callers cannot edit waiting commands. The queue
holds at most 128 pending operations by default (configurable 1–4096); overload rejects immediately
without changing the room. This bound is not per-user rate limiting or network backpressure.

Saving/encryption failure, invalid save acknowledgement or CAS conflict halts ALL later reads and
writes, including commands already queued. No mutated state or success acknowledgement escapes.
Do not retry arbitrary new writes from that memory. Recover from storage instead. If the write
committed but its response was lost, recovery sees the accepted action/receipt or original deal;
if it did not commit, recovery sees the prior state and permits an appropriate retry after fresh
connection. No rollback assumes which side of an ambiguous network failure committed. Recovery
also handles terminal accounting and next-hand creation without duplicate payout/reshuffle.

Deadlines retain the timestamp sampled by the engine at the decision; storage latency does not
extend a turn. A delayed response may contain a deadline already due. The future scheduler must
read the restored/current deadline and call `expireTurn`; it is not started by this wrapper.

## Required transport integration

Resolve verified identities on the server; do not accept a member/actor, stack, blind terms or
server timestamp selected by a client. Route each room to one owner using a trusted registry. The
class is not a distributed lease/election service: CAS rejects stale writers, but an old owner can
still serve stale in-memory reads until a conflicting write halts it. Do not deliberately serve
multiple owners for a room. Storage reads must be authoritative/consistent for recovery.

Transport must await methods, handle halted/reconnect responses, apply origin/session validation,
rate limits and private socket delivery, schedule trusted timer/deal callbacks, and coordinate
shutdown/restart. It must not access lower-level engine instances in parallel. The existing demo
continues to use its local engine until that separate transport integration is ready.

## Verification

22 owner regressions cover held writes/reads, stale and duplicate packets, save failure before and
after commit, fresh boots, reconnect invalidation, CAS fencing, timeout writes, initial/next deal,
queue bounds, invalid commands and a six-player tournament through champion with inter-hand boots.
`db/tests/poker_persistence_isolated.cjs` now runs 43 PostgreSQL checks, including the actual
Supabase RPC adapter plus this owner recovering a lost terminal acknowledgement, a single result
log, replay after reconnect, fresh startup and rejection of the stale owner. Existing engine,
privacy, schedule and UI regressions remain in CI.

Authenticated Request/Response composition is now available in
[poker-player-requests.md](./poker-player-requests.md). It is not yet mounted in a running service.

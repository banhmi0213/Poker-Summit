# Encrypted room checkpoints and terminal logs

Backend preparation for PR #194. Nothing is attached to the existing local demo, an API,
WebSocket process, real authentication or a running scheduler. The migration is authored and
verified in disposable PostgreSQL; it has NOT been applied to production.

## Recovery contract

`ScheduledTournamentRoom.checkpoint()` contains sensitive server state: member-to-seat bindings,
initial stacks/positions, the private dealt board/holes, accepted commands, deadlines, structure,
elimination history and settled accounting. Never broadcast, log, put in client storage or save it
unencrypted. Public/private transport snapshots remain the only network projections.

`AuthoritativeHand.restore()` injects the original private deal without shuffling and replays up to
4096 accepted commands to rebuild the betting state, payouts and idempotency receipts. The replay
validates cards and actions. Nested checkpoint version fields reject unsupported versions. Room
restore preserves physical positions, hand number, frozen blind terms, schedule, monotonic clock
floor and original deadline; it does not give an overdue actor another turn budget. The trusted
scheduler must invoke `expireTurn` using the restored deadline; one callback advances at most once.

Socket capabilities are OMITTED, not encrypted/persisted. All restored seats are disconnected.
Verified members must reconnect to obtain fresh tokens. Old sockets cannot read private cards,
act or disconnect replacements. Initial deals require reconnection of all waiting players;
already-started tournaments retain offline seats and their existing timeout behavior.

## Encryption and storage

`sealCheckpoint` / `openCheckpoint`: AES-256-GCM, random 12-byte nonce, 16-byte authentication tag,
2 MiB plaintext limit. AAD binds format, room UUID and storage version. Keys are supplied via a
backend-only key ring: 32 random bytes per key; never derive from member passwords, reuse a public
Supabase key, expose through `NEXT_PUBLIC_*`, or commit keys. Retain previous key IDs during
rotation. A wrong/missing key, changed ciphertext/tag or another room/version fails closed. No
recovery can succeed after permanent key loss. Authentication protects stored contents; it is not
anti-rollback protection against a privileged DB operator restoring an older entire database.

`SupabaseRoomStore` accepts a DEDICATED backend service-role RPC client, not a user-session client.
It never reads environment credentials itself. No new environment configuration is needed until
an actual server is connected. `restoreRoom` reads/decrypts/restores a persisted room and returns
its storage version. SQL table version and hand/room revisions are separate counters.

`prepareRoomSave(roomId, expectedVersion, room, keys)` captures a detached checkpoint and the
terminal result (when present). `commit(store)` saves both in one DB function transaction. Keep
this prepared object until its outcome is known: an ambiguous network error must retry the exact
same write ID/ciphertext/result. A fresh encryption is a different write. A later successful write
retires that old retry; reload on conflict. Caller mutation of the exposed request cannot alter
`commit`'s captured request.

The migration creates `poker_private.room_checkpoints` and `poker_private.hand_results` with RLS
and no browser-role access. Only service_role may execute the two public security-invoker RPCs;
functions have empty search paths. Row locking + expected-version CAS serialize writers, including
initial creation. One result per (room,hand) is immutable, and changed terminal results abort the
entire checkpoint update. Logs include hand ID/number, winners, payouts and elimination/champion
accounting, without holes, future board, member identifiers or connection tokens. These logs are
not wallet transfers or prize issuance. No public log-reading endpoint/UI is included.

## Owner integration

The queue/commit/recovery boundary is now implemented in
[DurableRoomOwner](./poker-durable-owner.md). Use it rather than calling the raw primitives from
transport. It serializes reads and writes, waits for commit before returning, and halts on failure.

Before transport is live: apply/review the migration in its intended environment, manage keys and
backups, verify member identity, serialize operations in one room owner, load existing state before
accepting commands, and durably commit every mutation BEFORE acknowledgement/broadcast. Do not
mutate a room further while its prepared save is pending. On save failure/conflict, stop serving
that owner, reload the committed state and require reconnect. These primitives do not roll back
mutated in-memory objects, elect owners, perform background autosave or run a scheduler. CAS
prevents lost updates; it does not authorize transport calls or replace owner coordination.

Restart recovery covers the last COMMITTED mutation. An uncommitted action may be retried after
reconnect; an acknowledged action must already have its receipt persisted. New-hand creation must
commit its generated deal before any cards are sent. Never blindly create a fresh hand after an
uncertain save, since the prior deal may already be committed.

## Verification

- `npm run test:poker`: 273 total regressions, including 18 persistence cases: encrypted roundtrip,
  all streets, replay receipts, socket invalidation, overdue turns, next levels, full tournament
  restarts through champion, key rotation/tampering, save conflicts and ambiguous response retries.
- `POKER_PGLITE_MODULE=<isolated PGlite module> node db/tests/poker_persistence_isolated.cjs`:
  43 PostgreSQL checks; actual adapter/RPC save/load and encrypted restoration, CAS, immutable atomic
  terminal logging, durable-owner lost-response recovery, permission denial and RLS defense if SELECT grants accidentally broaden.
- CI also runs the earlier 42 SQL checks, 2 React lifecycle tests and Vercel Preview build.

No manual UI verification is needed for this stage. Production merge and Railway remain deferred.

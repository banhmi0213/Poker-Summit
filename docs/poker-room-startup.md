# Backend discovery, configuration and recovery

Prepared code only. No production migration/configuration or Railway service
has been changed. There are now **seven unapplied backend migrations**, ending
with `20261017065003_poker_room_startup_discovery.sql`.

## Discovery

`createPokerRoomService` discovers bound rooms through the trusted directory
when no explicit `roomIds` manifest is supplied. The service-only invoker RPC
`poker_room_startup_ids` reads enabled bindings in UUID order, returning only IDs.
It reads one more than the configured limit; the adapter rejects overflow
instead of silently starting a subset. The partial index supports ordered reads
of enabled bindings. Publication/start time is not a discovery filter: pausing
an event must not abandon its already assigned room. Finished rooms are also
restored to retain result viewing; the scheduler will stop without a new deal.
Administratively disabled rooms and unbound/orphan/frozen-only plans are omitted.

Discovery failure, malformed IDs, duplicates or overflow prevent the listener
from opening. Individual encrypted restore failures quarantine that room; other
healthy rooms may continue. No discovery retry invents or provisions a room.
This is startup discovery, not a background database poll. New rooms finalized
through this process are activated by its confirmed-binding notification.
Out-of-band provisions need an explicit trusted restart/manifest update.

## Server-only configuration

`createConfiguredPokerRoomService(env, fetch?)` creates an isolated backend SDK
client and separate public-key Auth clients. Construction performs no network
request; the returned service's `start()` performs discovery, restoration and
listening. Backend and Auth calls have a 10-second deadline and preserve caller
cancellation. No configuration object or raw SDK error should be logged.

| Variable | Required value |
| --- | --- |
| `POKER_SUPABASE_URL` | HTTPS origin; local loopback HTTP permitted for isolated development |
| `POKER_SUPABASE_SECRET_KEY` | Server secret key, or legacy service-role key |
| `POKER_SUPABASE_PUBLIC_KEY` | Publishable key, or legacy anon key; never the secret key |
| `POKER_ROOM_KEYS_JSON` | JSON object mapping key IDs to canonical Base64 strings of exactly 32 bytes |
| `POKER_ROOM_ACTIVE_KEY` | Existing key ID used for new encrypted writes |
| `POKER_ROOM_ORIGINS` | JSON array of exact allowed HTTPS web origins; local loopback HTTP allowed |
| `POKER_ROOM_HOST` | Default `127.0.0.1`; explicit `0.0.0.0`, `::1`, or `::` also accepted |
| `PORT` | Integer 1–65535, default 3001 |
| `POKER_ROOM_MAX_ROOMS` | Integer 1–10000, default 128 |

These names are server-only and must never use `NEXT_PUBLIC_`. JSON key material
must be generated/stored outside source control. Keep previous keys while any
checkpoint still references them; changing the active key does not make old
keys unnecessary. Parser failures use one fixed error without echoing values.
Key role classification validates configuration, not a user's JWT identity.

`registerPokerRoomShutdown(service, process, onClosed)` explicitly registers
SIGTERM/SIGINT handlers. It coalesces repeated signals and waits for durable
shutdown before calling the host callback. It does not forcibly exit; the host
entrypoint owns exit status, readiness and a platform shutdown deadline. The
returned function removes only these registered handlers.

A runnable deployment entrypoint/build, platform health route, TLS, secret
injection and rollout remain deployment preparation. This factory alone does
not change `npm start` or deploy a listener on Vercel/Railway.

## Recovery procedure

1. Keep one authoritative process only. Stop/await its shutdown before another
   process restores the same rooms; rolling overlap is unsupported.
2. Check aggregate service health and trusted operator logs. Do not log bearer
   tokens, keys, member rosters or decrypted checkpoints.
3. For startup-wide failure, repair missing migrations/connectivity/configuration
   or the startup capacity, then explicitly start a fresh service instance.
4. For a quarantined room, inspect binding/configuration and restore the required
   historical key. Preserve the encrypted row and its version; never delete it
   to force a new deal. Ambiguous saves are reconciled against actual storage.
5. After the cause is fixed, trusted host code may explicitly call
   `service.recover(roomId)`. No player/manager HTTP endpoint can invoke recovery.
   On failure the room remains quarantined. On success all players reconnect;
   old connection capabilities do not survive restored state.
6. A frozen but unbound registration plan is not a discovered room. Retry its
   original finalization after checking current permissions/terms. Stale terms,
   expired deadlines, corrupt/nonpristine orphan state or deleted participants
   require explicit operator reconciliation. There is no automatic thaw or
   replacement roster/room.

Verification uses isolated PostgreSQL with actual migration/ACL checks and
loopback HTTP integration, not live production or multi-session lock testing.

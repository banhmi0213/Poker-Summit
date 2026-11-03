# Single-process room service composition

`createPokerRoomService` combines the durable registry, runtime, HTTP player /
lobby / registration manager routes, and authenticated WebSocket invalidations.
Construction does not bind a port or start timers. Call `start()` explicitly.
Concurrent starts share the same startup result. The default listener is
loopback on an ephemeral port; deployment must explicitly supply host and port.

The trusted caller supplies an existing dedicated backend directory/store,
encryption key ring, public Auth verification configuration, exact web origins,
and optionally a bounded manifest of **already bound** room IDs. Without that
override, the trusted directory discovers enabled bindings before restoration. No browser request can
supply the startup manifest, restore arbitrary checkpoints or create a new deal.
Restore finishes before the listener opens. Corrupt/missing rooms stay
quarantined and return 503 even if the player would otherwise be admitted.
Other healthy rooms and manager/lobby routes can continue.

Manager finalization confirms durable binding and its status before invoking
`onRoomBound`. That notification activates the new room in the same runtime.
A notification failure does not undo registration binding: retry reconciles the
same frozen room ID. It never creates a replacement room. Quarantine requires
explicit trusted `service.recover(roomId)`; no HTTP recovery endpoint is exposed.

`close()` prevents new transport work, stops future scheduler ticks, closes
WebSockets (including durable presence cleanup) and waits for accepted handler,
finalization and owner operations. Scheduler draining also waits for decisions
whose timer was already stopped. A pending save is not cancelled or treated as
rolled back when shutdown starts. Repeated closes share one result.

This is a composition API, not a deployment script. Database discovery,
validated configuration and explicit signal hooks are now prepared in
`room-server.ts`; see [startup and recovery](poker-room-startup.md).
A dedicated host entrypoint/build and coarse probes are now prepared.
TLS/reverse proxy configuration, platform readiness integration and production
database rollout remain to be wired
and verified before Railway deployment. No migration is applied here.
There is no cross-process leader lease: use exactly one authoritative process;
rolling deployments must not run two owners for the same room concurrently.
No browser/table layout is changed.

## Verification

`npm run test:poker` includes actual loopback HTTP and WebSocket tests with the
real registry, encrypted store format, request boundaries and Supabase Auth
adapter. Auth network responses and the directory/storage backend are isolated
test doubles, not live Supabase. The tests cover:

- Inert construction, coalesced startup, restored owner before traffic.
- Finalization, two distinct users joining, automatic first deal, own hand only.
- Revision-only socket messages and idempotent finalization retries.
- Corrupt checkpoint quarantine and rejection of unmanaged player rooms.
- Failed binding followed by same-room retry; no early activation.
- Shutdown during restoration and an accepted durable save.
- Occupied port cleanup and invalid startup manifest.

These tests are not multi-browser end-to-end or multi-session Postgres lock tests.

# Explicit room startup coordinator

`RoomRuntime` is a trusted, single-process coordinator. Construction is inert.
Call `start(roomIds)` with a bounded, server-owned manifest of already bound
rooms. It loads each encrypted durable owner before starting its scheduler.
Missing, halted or corrupt rooms are quarantined; other rooms can still start.
Only an explicit operator `recover(roomId)` clears a failed startup. No room,
roster or deal is created as a fallback. Player input must not supply this manifest.

After durable registration binding, trusted bootstrap code can call
`activate(roomId)`. Concurrent activations coalesce. Shutdown prevents a late
restore from arming timers. Already accepted durable writes are not cancelled.
The health getter returns aggregate counts only, never cards or member IDs.

This module is not a running service. Database discovery, actual HTTP/WebSocket
bootstrap, registration notification wiring and graceful draining of scheduler
writes remain separate integration work. No Railway service or production
migration is activated by importing it. Use one authoritative process only;
there is no distributed leader lease.

Verification: `npm run test:poker`, including a real encrypted owner restart,
same-hand preservation, disconnected capabilities, quarantine, startup bounds,
coalescing and shutdown during restoration.

# Tournament finish and result presentation

- `completedAt` is the authoritative finish time. A champion freezes the schedule
  at that time. Snapshots expose `autoExitAt = completedAt + 600000`.
- The browser returns to `/poker-lobby` at this absolute deadline. Background
  reads and manual reconnects do not reset it. A disconnect after observing a
  finish does not cancel the navigation timer; unmount/account context reset does.
- After the deadline, the backend rejects player joins, connects and private
  snapshots. WebSocket verification then closes existing connections normally.
  Results, participant mappings, standings and encrypted checkpoints are retained.
- This patch does not delete durable rooms or results, and does not implement
  the separate all-players-exited ephemeral room cleanup feature.
- A server-owned runout marker stores the hand identity and board count before an
  all-in settlement. Missing community streets display every 1.2 seconds. The
  server settles and saves the hand once; the browser only changes its display.
  Showdown outcome/winner stacks wait until the reveal ends, then coins travel
  from the POT to each paid seat. Reduced-motion users skip coin movement.
- Existing legacy checkpoints without a runout marker still load. Rejoining after
  the presentation window does not replay it. Default eight-second hand pauses
  accommodate the longest 4.8-second reveal plus 1.2-second payout window.

Validation: engine/server suite 420 passed; online React lifecycle suite 34 passed;
dedicated backend build passed; Next production build passed with staging public
configuration. Full repository typecheck still has pre-existing unrelated errors;
no errors were reported for the changed poker files. Eleven PC/mobile layout
fixtures and flop/turn/river/payout/finished browser render fixtures passed.
Deployment is pending. No production branch, live service, DB schema or existing
live tournament was changed for this feature.

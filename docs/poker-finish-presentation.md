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
  all-in settlement. Missing community streets display every 2.2 seconds. The
  server settles and saves the hand once; the browser only changes its display.
  Showdown outcome/winner stacks wait until the reveal ends, then coins travel
  from the POT to each paid seat. Reduced-motion users skip coin movement.
- Existing legacy checkpoints without a runout marker still load. Rejoining after
  the presentation window does not replay it. The authority retains the normal eight-second pause but extends all-in
  hands as needed: the longest 8.8-second reveal plus a 1.2-second payout
  animation and one additional second before the next hand.

## Online sound effects

The online table now uses Web Audio effects matching the demo (turn, action,
deal and victory), plus ascending entry and descending exit cues. The context
is unlocked only by user input. Audio errors never interrupt play. The menu
contains an SE toggle. Repeated polling and reconnecting do not replay old
hand sounds; sounds follow the displayed runout stages. Exit controls and the
automatic deadline wait up to 350ms for the exit cue before navigating. Contexts,
listeners and navigation timers are cleaned up on unmount.

Validation: 422 engine/server tests and 35 online React lifecycle tests passed;
dedicated backend and Next production builds passed. Full repository typecheck
still has unrelated pre-existing errors, with no errors in changed poker files.
Real browser Web Audio checks created all six cues after a user click, suppressed
playback before unlock and while muted, and verified the slower board stages.
These checks exercise audio APIs; actual speaker volume remains a user check.

PR #301 was deployed to staging and the user confirmed seating, scheduled start,
automatic exit ten minutes after finishing, and history on both accounts.
The subsequent slower runout and SE changes are not deployed yet. No production
branch, live service, DB schema or tournament data was changed for this patch.

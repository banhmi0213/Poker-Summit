# Staging timeout / reconnect investigation

Incident: 2026-10-19 15:03–15:05 UTC. Both players idled, then could not reconnect.
The running backend was 9642b9b35cb152172086d30422ea958108fa4bca.

Observed evidence:
- Railway: one running replica, deployment SUCCESS, no contemporaneous crash/redeploy.
- /healthz 200; /readyz 503; lobby 200; affected room requests 503.
- DB hand_results retained hands 1–14. Hand 14 committed 15:03:19 UTC;
  checkpoint version 46 last updated 15:03:56 UTC. No keys or decrypted
  checkpoints were retrieved. These records do not identify the original error.
- Error handlers suppressed the underlying scheduler failure. The exact original
  cause is unconfirmed. A transient control RPC failure is one reproducible
  failure path, not a proven explanation for this incident.

Changes:
- Retry ONLY failed control reads before any owner mutation, after 1/2/4 seconds.
  Four consecutive failed reads still quarantine the room. Successful reads reset
  the retry counter. Invalid metadata and ambiguous writes never auto-retry.
- Log fixed scheduler event/reason fields and room UUID, never raw exceptions.
- Storage failure logs contain operation and allowlisted DB error code only;
  messages, SQL details, checkpoints, emails and tokens are excluded.
- Regression tests cover 1,000 durable idle decisions, chip/seat conservation and
  same-hand reconnect after loading the saved encrypted checkpoint, read recovery,
  bounded retry exhaustion, malformed metadata and diagnostic redaction.

Validation: all 417 engine/server tests passed, including 47 focused
persistence/scheduler tests. Dedicated backend build passed. No UI or DB schema changes. Production and existing staging data have not
been modified by this patch. Deployment and live recovery remain a separate step;
full incident resolution must not be claimed from these local tests alone.

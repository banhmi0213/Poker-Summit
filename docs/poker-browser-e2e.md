# Isolated multi-browser tournament validation

Run `node tests/poker-browser-e2e.cjs` with POKER_ESBUILD_MODULE,
POKER_PGLITE_MODULE, POKER_CHROMIUM_MODULE and POKER_PLAYWRIGHT_MODULE set to
installed module paths. CI installs pinned isolated dependencies and runs it.
POKER_E2E_OUTPUT selects the directory for bundles and screenshots.

Six separate Chromium browser contexts use the actual registration, assignment,
table and control components, real HTTP/WebSocket adapters, durable room owners,
encrypted checkpoints and PostgreSQL migrations/RPCs in PGlite. A seventh
unregistered browser must be denied. The narrow test gateway and Auth provider
exist only under tests; they are never application routes or production bypasses.

Coverage: six registrations, manager finalization, automatic seating/start,
private own cards, outsider denial, transport loss/reconnect, stale capability
rejection, duplicate tabs, same-deal/deadline server restart, disconnected actor
timeout, failed response after an accepted action followed by exact receipt retry,
all-in progression, conserved 1,200 chips, one champion, one immutable log per
hand and confirmed exit. Server time is controlled; deals still use real CSPRNG.
WebSocket payloads must contain only revision notifications, never private state.

Real Chromium exposed native Window.fetch receiver binding and intentional
exit/channel-loss ordering that mocked transports did not exercise. Both have
focused Node regressions as well as this browser journey.

This is isolated integration coverage, not deployed Supabase Auth, the actual
Next cookie/proxy gateway, TLS, load testing or cross-session Postgres locking.
Those remain deployment checks. No production database, migration, wallet,
prize, admission, server configuration or Railway resources are changed.

# Ring lobby admission: staged waiting-room integration

This phase connects the member lobby to actual chip reservation/seating and final-stack return through the dedicated room service. It deliberately does not start poker hands. The UI explains that this is a seating/recovery/refund validation phase. Gameplay, turn deadlines, disconnect handling, owner/session fencing and automatic next hands remain separate work.

## Request path and identity

The authenticated browser posts only to same-origin `/api/poker/ring`. Next forwards the request to the configured service origin. The dedicated HTTP adapter enforces body/header/in-flight bounds. The ring handler requires an allowed Origin, JSON, a verified Supabase bearer identity, no query or caller-selected member IDs and an exact operation shape. The dedicated service-role client invokes backend-only RPCs. No service secret enters the browser. Response projections include public table IDs/seat numbers/stacks and the caller's own reservation; opponent member UUIDs, emails and reservation UUIDs are stripped.

- `state`: returns published tables, the caller's wallet/current hold or seat, and optionally one public table's seat map.
- `join`: table UUID + amount + request UUID. One PostgreSQL transaction reserves the funds and accepts a free seat. Failed acceptance rolls back the debit/hold. Full/unpublished/active-hand tables and duplicate membership are rejected.
- `leave`: reservation UUID + request UUID. The verified member must own that exact reservation. Held funds are cancelled; seated funds use final-stack cashout. An old leave receipt cannot remove a newly created seat.

The browser stores only pending operation payloads in per-account sessionStorage, never tokens. It retains one exact operation through an ambiguous response/reload; mutations stay blocked until explicit reconciliation. A known transaction rejection clears the receipt and requires a state refresh. Account changes erase rendered state and discard late responses. Background refreshes do not blink action controls or overwrite a newer mutation. Corrupt/unavailable operation storage disables mutations while allowing read-only status.

A seated player remains seated through refresh/network loss/service restart because the seat and balance are stored in PostgreSQL. Closing a tab does not refund or remove a seat. Use explicit exit while this waiting-room phase is under test. No scheduled seated timeout or live-hand timeout is claimed by this release.

## Validation and rollout

`npm run test:poker` includes command/projection/auth/privacy/receipt tests. The isolated accounting script additionally runs `tests/sql/poker-ring-admission.sql`, covering capacity, ownership, stale receipt/re-seating isolation and rollback of a rejected hand-in-progress admission. `tests/poker-ring-browser-e2e.cjs` mounts the actual component in separate browsers and uses the real HTTP adapter/handler/PostgreSQL RPCs, including lost acknowledgement/reload, two buy-ins, capacity, re-entry view, refund, mobile width and sign-out privacy. Test-only Auth/session fixtures never become application routes. CI runs both ring browser and existing tournament browser suites.

Apply the admission migration only to staging. Deploy the service source to that same staging database and update the existing Vercel validation branch. Keep one Railway replica and retain the existing keys/origin configuration. Production remains unchanged. Do not promote this waiting-room feature as playable ring poker.

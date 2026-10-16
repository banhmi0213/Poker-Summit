# Authenticated player request boundary

Backend preparation. `createSupabasePokerPlayerHandler` composes real Supabase verification with
standard Request/Response handling and the durable owner. It is not mounted as a Next route or
listening HTTP/WebSocket server. No existing demo UI, production DB, credentials or Railway setup
is changed. Tests exercise the real SDK against stub HTTP responses, not real user credentials.

## Identity and admission

The server receives the browser's Supabase access token in `Authorization: Bearer <token>`.
`createSupabasePokerAuthenticator` creates a fresh client per verification using the public project
URL/key, disables session persistence/refresh/URL detection and calls `auth.getUser(token)` against
Auth. It never trusts decoded user JWT/session data, body identity or user-editable metadata. The
verified Auth UUID becomes the member ID. The adapter rejects deleted, anonymous, non-authenticated
or currently banned users, then invokes the existing `is_suspended()` RPC with the SAME bearer
JWT. Only an explicit boolean false permits access; lookup errors fail closed. This rechecks Auth
and current suspension on every request, including reads/spectating. Public key configuration
accepts publishable keys or legacy anon JWTs, never secret/service-role keys. Decoding a legacy
CONFIG key merely classifies its role; it is not user authentication.

A separate mandatory server `authorize({memberId,roomId,operation})` callback decides room admission
for every operation. There is no default allow-all policy. Authentication alone does NOT grant
seating, tournament admission or private-room observation. Deployment must bind each room to its
actual tournament/registration/visibility policy before using this factory. A missing callback is a
configuration error; false/null/error denies. No new registration database or paid admission rule
is introduced here. Authorization is checked before owner dispatch, not atomically inside a queued
DB transaction; immediate policy revocation of already dispatched operations is not guaranteed.

`owner(roomId)` must return the one existing DurableRoomOwner from trusted routing. It must not
create/recover a new owner for every request. A missing authorized room returns 404; errors return
503. Scheduler, room creation/recovery, blinds/stacks and checkpoint access have no player command.

## Browser request contract

Only POST with an exact configured Origin and `application/json` is accepted. No cookie-only auth,
GET state endpoint, query parameters or automatic cross-origin CORS permission is provided. Intended
browser deployment is behind a same-origin proxy. A separate-origin service would need an explicit
reviewed CORS/preflight adapter before it can be used by the browser.

The trusted route supplies the room UUID separately. JSON bodies are bounded to 4096 actual UTF-8
bytes even without Content-Length, and exact fields are required:

| Body | Connection header | Result |
| --- | --- | --- |
| `{type:"seat",seat:1}` | omitted | Seat the verified member, fixed stack policy |
| `{type:"connect"}` | omitted | Rotate own connection, return own token/private projection |
| `{type:"spectate"}` | omitted | Authorized public projection |
| `{type:"state"}` | required | Own current private projection |
| `{type:"act",command:{handId,revision,actionId,action}}` | required | Validated betting action / committed receipt |
| `{type:"disconnect"}` | required | Disconnect own current capability |
| `{type:"leave"}` | required | Leave if engine policy permits |

`X-Poker-Connection` must contain the current connection UUID for state/act/disconnect/leave. Both
verified member and matching capability are needed: another member's token grants no private cards,
action or disconnect. Seat number is only a requested vacancy; it never selects actor/viewer identity.
Shared `parseHandCommand` enforces the existing authority grammar, including exact nested wager
fields. Reserved timeout IDs and scheduling/admin commands reject. Body member/viewer/actor IDs,
stack, deck and clock overrides reject rather than being silently trusted.

Every success awaits the DurableRoomOwner operation. No HTTP success/private cards escape a pending
write. Duplicate actions return durable receipts; stale commands/tokens/locked seats return generic
409 `refresh_required`. Halted owners/storage failure/queue overload return generic 503. Internal
errors, bearer tokens and keys are never reflected. All responses use no-store/private, Pragma,
Vary on Origin/Authorization/connection and nosniff. Do not log authorization/connection headers.
An abort observed before dispatch prevents an operation; after dispatch a durable commit must not
be undone because the socket/request went away. Use the action ID to resolve retries.

## Deployment still needed

Connect the real room admission policy/registry, lifecycle/scheduler, routing/proxy/TLS, request/auth
rate limits and network timeouts, cookie-to-bearer client integration, reconnect UI and private
socket delivery. The owner's queue bound is not an Auth-service rate limiter. `getUser` is live user
verification, not a guarantee of immediate JWT revocation after sign-out; strict revoked-session
checks against session IDs are not installed. Handle token expiry/refresh on the client and never
use a service-role storage client for user identity. No endpoint is publicly activated by this PR.

## Validation

23 request/auth regressions: real SDK Auth/RPC request headers, fresh user/suspension checks and
identity isolation, rejected metadata/roles/bans/deletions, admission denial, strict schemas,
origin/method/body limits, stolen/replaced capabilities, receipts/stale packets, owner save gating,
generic failures/no caching, and composed authentication plus durable seating. Full suite: 232 Node
regressions; CI also runs 85 isolated PostgreSQL checks and 2 React lifecycle cases plus Preview build.

# Server-owned hand coordinator

`lib/poker/authoritative-hand.ts` is a transport-independent single-hand owner. The existing browser demo is unchanged. Do not import the class or any private deal shape into a client component.

## Trusted initialization and identity

A server loads seated member IDs, positive virtual stacks, button and forced-bet terms from trusted state, then creates `AuthoritativeHand(entries, buttonIndex, terms)`. It privately shuffles/deals, posts blinds/antes, and handles immediately forced all-ins. Constructors reject duplicate seats, unsafe stacks and reserved object-property IDs. The server-only deal helper is reused internally; its complete deal is NEVER returned as a client payload.

Only `snapshot(authenticatedSeatId)` crosses the player boundary. `snapshot(null)` is a spectator projection. Resolve the seat from authenticated membership and a server seating record. Do not pass a client-selected user/seat/viewer ID directly. Unknown viewer/actor seats are rejected. Spectators see no private hand and have no legal actions.

Before showdown, each player receives only their own cards, the currently exposed board, public chip/action positions and their own legal actions. Showdown reveals only non-folded hands; a folded player can still inspect their own hand privately. A fold victory exposes no additional board or opponent cards. No deck, burns, future board, shuffle seed or receipts are serialized. Projections are fresh copies. JS private fields prevent accidental `JSON.stringify(owner)` from leaking state.

## Command protocol

The payload has exactly `handId`, `revision`, `actionId`, `action`. Action is exactly `{type:'fold'|'check'|'call'}` or `{type:'bet'|'raise',amount:positive safe integer}`; amount is the engine's target street total, not an incremental debit. Extra fields (including actor, cards, stacks or deck) are rejected. `actionId` is 1-80 ASCII letters/digits/underscore/hyphen. Authenticated actor is a separate trusted method argument.

`act(actor, payload)` validates identity, hand and revision, then runs existing legal betting and automatic street/settlement calculation. No await occurs between version check and commit. A rejected command leaves all state intact. Accepted commands increment revision once, regardless of how many streets auto-run.

Exact retry of an already accepted per-seat action ID returns `replayed:true`, its original `acceptedRevision`, and the LATEST personalized snapshot without applying a wager again. Changed payloads sharing that ID are rejected. Delayed packets for another hand, competing/stale revisions, wrong turns and post-settlement commands are rejected. Receipts are retained for the entire owner's hand; at 4096 accepted actions further commands are rejected (no eviction that would permit replay). A transport should supply error codes/rate limiting and decide handling for this cap.

## Street lifecycle and chips

The server advances streets only after betting completes; board lengths are 0/3/4/5. When further betting is impossible, existing side-pot/showdown rules run out the board automatically. Payouts are a terminal snapshot, never added multiple times. Live pot becomes zero after settlement; final player stacks include awards once. Historical committed fields remain for audit and must not be added to final pot/stacks by consumers. Clone result objects too.

## Reconnection and deployment limits

A reconnect can request a fresh personalized snapshot from the SAME live owner. This is not persistent recovery after server restart. No WebSocket endpoint, auth/session binding, seating, wallet updates, timers, disconnect policy, next-hand coordinator, multi-table or durable result storage is shipped here.

A future transport MUST provide one exclusive owner per hand or a shared transactional compare-and-swap over revision + command receipt + new state. Creating independent owners on multiple replicas is unsafe. Persist accepted state and receipt atomically before acknowledging a durable command. Never use the current demo deal endpoint to broadcast opponent hands.

Railway creation/deployment remains deferred by user request until development is complete. This stage adds backend logic and regression coverage only, with no production gameplay change or database migration.

## Validation

12 new tests cover privacy, safe copies, authenticated-actor separation, strict malformed input rejection, stale/wrong-hand packets, exact retries, action ID conflicts, competing versions, all streets, folded-card secrecy, fold victory, all-in runout and ante-only starts. 100 complete 2-6 player simulated hands verify private-card filtering and chip conservation. Existing 109 regressions remain (121 total). CI also retains 42 isolated PostgreSQL checks and 2 React demo lifecycle tests.

## Seating owner follow-up

`SeatedHandRoom` now supplies an in-process member-to-seat and current-connection wrapper around this class. See `poker-seated-hand-room.md`. It does not yet validate real login credentials, provide network transport or durable recovery. Total regression coverage is now 133 tests.

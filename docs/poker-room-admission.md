# Tournament admission and process-local room registry

Backend preparation: no public route/listener, registration UI, production DB migration or Railway
change. The new migration must follow the prepared checkpoint migration. Existing tournament
configuration remains in `public.poker_tournaments`; the directory freezes its game terms per room.

## Policy

The trusted pre-start provisioning operation binds a new room to a PUBLISHED, future tournament,
2–6 distinct existing Auth user UUIDs, capacity 2 or 6 and an explicit spectator setting (default
deny). These are operator/server inputs, never player body fields. No wallet deduction, prize,
payment, late entry, re-entry or table movement is implemented. Capacity is the permitted roster
size; the engine still uses six physical slots and handles two occupied players as heads-up.

The request handler now has a concrete `SupabaseRoomDirectory.authorize` implementation:

| Request | Admitted to this room | Other verified member |
| --- | --- | --- |
| Seat | Allowed only while tournament published; engine must still be waiting | Denied |
| Connect/state/act/disconnect/leave | Allowed; engine still checks seat, connection, turn and phase | Denied |
| Spectate | Allowed, including after unpublishing | Only published + spectator permission |

A disabled room denies every player request. Authorization is read from DB EVERY time, including
for cached owners. Unpublishing prevents new seating/general observation but does not strand
already admitted players mid-hand. Admission to another table in the same tournament does not
confer participant rights here. Anonymous/suspended/deleted users are still rejected by the Auth
boundary before this policy. Deleting an Auth user cascades their admission; there is no replacement
or automatic roster refill. Already dispatched work is not transactionally revoked by a later
policy change. A disabled request gate does not itself stop trusted scheduler callbacks.

## Storage/provisioning invariants

`poker_private.tournament_rooms` binds checkpoint room UUID -> tournament UUID, frozen start/structure,
capacity and visibility flags. `room_admissions` has primary key (tournament,member), enforcing one
table assignment per tournament, plus a composite FK to the same room/tournament. Both tables have
RLS, no browser role access/policies and only the dedicated backend role's required grants.

Four public RPCs are security invoker with empty search paths and execute permission ONLY for
service_role: load published future tournament config, load binding, check operation access and
provision. The role gets SELECT plus column UPDATE(id) on the tournament table specifically to
allow SELECT FOR UPDATE; no anonymous/authenticated privilege is widened.

Provision locks the tournament row, validates unchanged published/future config, then locks the
checkpoint and requires version 1 (the pristine committed empty room). It inserts binding+roster
atomically. Capacity, duplicate/null/missing users, moved members and stale configuration fail.
An exact roster/config retry succeeds without rewriting or enabling a disabled room. Changed
rosters are rejected; normal service use must go through the provisioning RPC, not direct table
INSERTs. Privileged maintenance can bypass application invariants and is not exposed here.

The empty checkpoint save and directory transaction are two separate commits. If provisioning
fails, its owner is not returned/served. A failed pre-commit directory write can leave an encrypted
UNBOUND checkpoint; no directory lookup serves it. An ambiguous response may already have committed
the binding: inspect it and load the same room, never blindly delete/redeal. Job-level reconciliation
and orphan cleanup are future operator work. The factory does not auto-retry a new create on the
same room ID. Repeated provisioning RPC calls can resolve an uncertain directory response.

## Registry and recovery

Use one `TournamentRoomRegistry` per trusted process. `owner(roomId)` only loads known/enabled,
bound existing state. It never invents a new game for missing/corrupt storage. Concurrent lookups
share one pending promise, one recovery write and one owner. Provisioning reserves that promise
before I/O too, so a lookup after binding commit cannot race a second owner. Missing/failed entries
are evicted; halted owners remain cached until explicit operator `recover`, not silently replaced.
The registry defaults to 128 loaded/pending rooms; no automatic eviction risks duplicate owners.

Registry loads pass the frozen expected start/structure into DurableRoomOwner. Both load and recover
compare them before committing/resuming. A mismatch rejects; a later edit to the PUBLIC tournament
config does not rewrite the bound room's blinds/stack. Recovery retains the original deal and chips.
This is process-local coordination + DB CAS, NOT a multi-process lease/election. Route each room to
one process. No server is started by constructing the registry.

`registry.playerHandler({origins,auth})` composes the Supabase identity verifier, fresh admission RPC
and registry lookup with durable dispatch. Players cannot call provision/recover/start/next/timers.
The future scheduler MUST wait for the complete assigned starting roster to seat/connect before
initial dealing; the lower-level engine alone only knows occupied seats. Start/timeout orchestration,
roster-readiness reporting, operator admission controls, network limits and client UI remain separate
work. No player-visible room listing/admission list or member identifiers are broadcast.

## Verification

16 new Node regressions (248 total): frozen config, wrong bindings, provision failure/uncertainty,
coalesced loads, lookup/provision races, queue bounds, fresh admission and explicit recovery.
71 new isolated PostgreSQL checks execute actual migrations/RPC adapters, registry, HTTP dispatch,
2/6-person assignments, duplicate table denial, immutable roster/config/pristine guards, spectator
policy, unpublishing continuity, Auth deletion and privilege/RLS denial. CI retains earlier 85 SQL
checks and 2 React lifecycle cases plus Preview build. No real credentials or production DB used.

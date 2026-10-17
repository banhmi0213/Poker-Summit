# Isolated public staging setup

Status on 2026-10-17: staging resources created; not deployed or connected.
After the user selected a separate Free project and confirmed the same organization,
creation was quoted at $0/month. Supabase poker-summit-staging is ACTIVE_HEALTHY
in ap-northeast-1, ref mjdgylgzhsygcgtuceow. A scoped foundation and all ten poker
migrations (three configuration plus seven backend) were applied ONLY there.
Production still has seven backend migrations unapplied. No production rows copied.

Railway project 0f62a717-2c59-4ac2-95c9-acb6ddd460ed, staging environment
7c17c451-e705-4d5e-abf2-eef7bb2988f2, service poker-room-server
(a8fb2457-ff22-4930-afc4-10905b42afc8) is configured but has no source or deployment.
Its reserved service URL is https://poker-room-server-staging.up.railway.app;
this is NOT a healthy/deployed endpoint. Public Auth URL/key, a fresh private
checkpoint keyring, Node 24 and listener/capacity values are stored in Railway.
No key values are in this document/repository. The service secret and exact
Preview origin are still missing. No paid plan upgrade performed; actual Trial
balance/verification has not been observed through the available account tools.

Vercel access now works, but the connected Poker Summit team
(team_enzgtM1j8Cn1ais7W0AW7P5H) lists no projects and lookup of poker-summit
returns 404, both with that team and default scope. Existing CI Preview success
is not evidence that the connected integration can edit that project. Correct
project/team access must be established before setting branch-only variables.
No new Vercel project was created and no existing environment settings changed.

## Concrete configuration

Use `config/poker-staging.env.example` as a mapping, not as a secret file. Select
an isolated Supabase project/branch with its own credentials. Never reuse the
portal production project. Review its foundation schema and migration history
before applying the seven backend migrations; do not blindly apply every pending
repository migration. Verify schema/RLS/RPC permissions and run Supabase advisors
on that target. Seed dedicated accounts/events without copying production users,
member balances, participant data or storage objects. Keep signup/invitation
emails under deliberate control; no test accounts have yet been created.

A preview branch can inherit Auth configuration with placeholder OAuth/SMTP
secrets. Configure only the intended staging login flow and exact staging
callback URLs. Actual account login/getUser and suspension checks still need
validation; `/auth/v1/settings` reachability is not login proof.

The dedicated server needs the staging secret key and a new checkpoint keyring.
The Next Preview needs only staging public Auth keys plus fixed backend HTTPS
and WSS origins. Scope Vercel settings to Preview and this Git branch; never
change shared Production values or deploy unrelated previews against staging.
The frontend and backend must use the SAME Supabase target and public key.
Use exactly one backend authority, with external TLS termination, exact app
origin allowlisting and health/readiness checks. A persistent backend host is
still required; this document does not create a host or start Railway.

## Read-only preflight

Run `npm run build:poker-server`, then `npm run check:poker-staging` with private
process environment containing the template's combined variables. No automatic
dotenv loader is used. The checker refuses production, mismatched projects/keys,
non-HTTPS origins, non-WSS events or socket/backend host mismatch BEFORE network.
Only the pinned staging ref is accepted. Redirects are rejected, requests time
out after 10 seconds, and logs never print keys, responses or remote exceptions.

It checks the public Auth settings endpoint, read-only startup discovery RPC,
backend `/healthz` and `/readyz`, and that both direct backend and actual Next
lobby gateway reject unauthenticated traffic. No registration, seating, config,
auth-user creation or game write is performed. Only the Supabase endpoint gets
the backend credential. Output intentionally leaves authenticatedGameVerified
and webSocketVerified false. The check has only run with network fixtures until
a staging target and public backend are available.

## Completion criteria

After preflight succeeds against the actual URLs, use dedicated real accounts
in independent browsers through the deployed Next application. Verify login,
manager/store scope, registration, room assignment, private cards, HTTPS/WSS,
reconnect, same-deal restart, timeout, exact retries, chip conservation, finish,
logs and exit. Confirm invalid/expired/suspended identities and unregistered
outsiders cannot see private cards. Check the deployed browser/network logs for
accidental secrets. Record actual commit/URLs/results; a Preview build alone
is not evidence that live multiplayer or Supabase Auth passed.


## Applied staging foundation and verification

`db/staging/poker_foundation.sql` is NOT a production migration or complete portal
schema clone. It was executed once only on the verified empty staging public
schema. Column definitions for stores/admin_users/member_status/audit_log/
site_settings were read from production catalogs without rows. Only required
primary/auth foreign keys and staging indexes/policies were installed; unrelated
portal constraints, external-table relations, triggers and features are absent.
Admin/status lookup preserves own-user role/suspension semantics with actual
Auth uid and INVOKER/self-read RLS, not constant test booleans. Anonymous self-read policies return zero rows (Auth uid is null); this lets
public event policies safely evaluate role/status helpers without privilege errors.
No users can grant themselves admin status. Store access is restricted to owner/admin, audit writes
to service_role; payment is disabled in a fresh non-production settings row.
This supports scoped poker/login validation, not the entire portal feature set.

Live PostgreSQL rollback verification in poker_foundation_verify.sql passed:
admin/suspended-member distinction, anonymous zero-row/public-event queries,
self-only status/admin reads, no role
escalation and no authenticated access to startup discovery. Temporary identities
and rows were rolled back, leaving accounts=0, tournaments=0, startup_rooms=[].
All scoped tables have RLS. Security advisors report INFO only for eight
intentionally service-only tables with RLS and no client policy; no client policy
was added to silence those notices. This is database access-control verification,
not an actual Auth login or a public browser game test.

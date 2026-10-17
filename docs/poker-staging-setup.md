# Isolated public staging setup

Status on 2026-10-17: NOT connected or deployed. The connected account lists
only the existing poker-summit production project and no development branches.
Creating poker-online-staging returned PaymentRequiredException: branching
requires Pro or above. No branch was created, no migration was applied, and no
production environment variable was changed. A separate project is an alternative;
its availability/cost must be checked before creation. Vercel installation was
confirmed, but its callable project/deployment tools have not appeared in this
session. Installation alone is not evidence of access to project settings.

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

# Ring chip wallet and welcome allocation

This change prepares a staged member wallet. The follow-up ring accounting core can settle server-authoritative hands, but it is not mounted in the public room service or lobby yet.

## Allocation

- Grant 3,000 virtual chips after email confirmation. Unconfirmed, anonymous, suspended, banned, deleted and synthetic store-login accounts are excluded. Normal-email admin members are eligible.
- Existing eligible members without a receipt are granted once on the next balance request. Registration/confirmation triggers cover new members.
- A unique member receipt and a keyed digest of the normalized email prevent repeat allocation and re-registration with the same email. No raw email is stored in the accounting receipt. Different email addresses are not proof of different people; stronger multi-account prevention is future work.
- Repeated balance requests do not mint additional chips. Accounting receipts survive auth account removal. Data-retention policy must cover these accounting identifiers before public rollout.

## Accounting and permissions

`available + in_play` is the member total. A welcome entry mints exactly 3,000; reservation and refund entries conserve the total. Ledger and welcome receipts reject updates/deletes. Private tables have RLS with direct client access revoked. Members can read only their own wallet through the authenticated RPC; server-only funding RPCs require service_role.

A reservation checks account eligibility, published table settings, buy-in limits, available balance, one open hold per member and table capacity. Account/table row locks and unique receipts enforce serialized accounting. Retries reuse request IDs; inconsistent payloads are rejected. Refund returns only the original reservation amount, exactly once. Held funds block table deletion or changes to stakes/capacity/buy-in.

Reservation expiry timestamps are recorded. The follow-up provides server-only seating, expiry release, final-stack cashout and atomic authoritative hand settlement. Public admission, continuous expiry scheduling and online room recovery still need to be wired before exposing a buy-in button. A funding reservation alone is not an occupied seat.

## Deployment and validation

Apply the 20261020 migrations in timestamp order. They have been applied only to the separate staging project. The production database has not been migrated by this feature.

`npm run test:poker` covers the wallet response parser alongside the existing suite. `tests/sql/poker-chip-ledger.sql` runs a rollback-only database integration check covering allocation, confirmation, replay, same-email reuse, eligibility, reserve/refund conservation and privileges. Run it only against a disposable/staging database with appropriate SQL access. It creates fixture auth rows inside a rolled-back transaction and does not send emails.

Still required before playable public ring games: public service admission and owner fencing, multi-session database contention tests, turn timers/disconnect handling, recurring expiry work, lobby/game controls, operating limits/monitoring and production rollout approval. See ring-accounting-core.md.

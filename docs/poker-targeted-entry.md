# Targeted tournament entry (prepared; deployment blocked)

Saved admin/authorized-store tournaments can designate 2–6 verified account emails. Private manager-only lookup resolves them to immutable Auth UUIDs; ordinary members receive only their own eligibility boolean. Target changes close ten minutes before start, cannot remove registered members and never expose target emails in the lobby.

The dedicated backend prepares an immutable eligible-member pool at start-minus-ten-minutes, polling every five seconds. Registration/cancellation remain open until start; room authorization requires registration. Only eligible members see the registration button, and the server rejects an ineligible direct registration request. The assigned-room panel refreshes every 15 seconds.

At start, occupied seats of registered eligible members form the initial roster. Registered no-shows are not charged or awaited. New seating is rejected at/after start. A checked-in disconnected player remains included and may reconnect; ordinary turn timeouts apply. Fewer than two seated players leaves the tournament waiting, without blinds or an automatic winner. There is no late initial seating in this mode.

The mode is persisted in encrypted checkpoints. Existing manually configured tournaments retain their full-roster start behavior. The first version supports a single 2–6-person table; multiple-table balancing and automatic rescheduling/cancellation after insufficient attendance are not implemented.

Local validation before publication: 413 automated tests, 35 React lifecycle checks, 109 isolated PostgreSQL management/admission checks. Node backend and Next builds were also checked. Entire-repository type checking has pre-existing unrelated errors; do not describe it as fully passing.

## Deployment dependency

Supabase staging apply_migration returned INVALID_ARGUMENT / Invalid or expired requestState. Read-only catalog verification confirmed the new tables/functions are absent. Do not deploy the new dedicated backend or describe the feature as available until the migration is successfully applied and verified. No production database or existing tournament/checkpoint was changed.

After reconnecting Supabase, apply the targeted_entry migration to staging mjdgylgzhsygcgtuceow only, check ACL/RLS and test RPCs, then publish the branch update and pin/deploy Railway staging to that commit. Keep the existing keyring, one replica and overlap zero. Confirm Railway SUCCESS/readyz and Vercel Ready before real-account validation.

User verification: create a new future tournament at least 15 minutes ahead, save it, open its target settings and add 2–6 existing verified account emails. Register from eligible accounts, confirm a non-eligible account has no registration button, enter/join the assigned room within ten minutes of start, and verify automatic start with only checked-in seats. Never reset the existing two-account test tournament as part of this check.

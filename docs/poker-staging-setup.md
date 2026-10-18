# Isolated public staging setup

Status on 2026-10-19 (Japan): staging deployed; authenticated two-account
registration/finalization verified; stable live multiplayer NOT yet verified.

Supabase poker-summit-staging, ref mjdgylgzhsygcgtuceow, Tokyo: scoped
foundation plus ten poker migrations applied only here. No production rows copied.
This is not a complete portal schema clone; the Preview homepage returns 500,
while login, lobby and demo return 200. Production backend migrations remain
unapplied. No paid upgrade performed.

Railway project 0f62a717-2c59-4ac2-95c9-acb6ddd460ed, environment
7c17c451-e705-4d5e-abf2-eef7bb2988f2, service
 a8fb2457-ff22-4930-afc4-10905b42afc8 (poker-room-server) has one authority.
Deployment f535b6d8-f454-4d44-b999-c3c1b6ddd20a, commit a732d356, reached
SUCCESS; poker_server_ready and public healthz/readyz 200 were verified.
https://poker-room-server-staging.up.railway.app is the backend origin.
Credentials/keyring stay in platform variables; never regenerate the keyring.
The deployment emitted dependency vulnerability warnings; audit remains open.

Vercel branch-only Preview is connected to staging:
https://poker-summit-git-chatgpt-poker-authoritative-hand-poker-summit.vercel.app
Public URL/key, backend HTTPS/WSS origins, site URL and the server-only staging
service key override apply only to this branch. Production/shared settings were
not edited. Deployment GstCj7Qnd61p1o1iqvEFrvDXHPur reached Ready.
Direct and Next lobby requests without Auth both returned 401 as expected.

Two dedicated user-created, confirmed Auth accounts logged in through the real
Next login page; both distinct successful audit identities were verified. The
user authorized temporary admin access for the first-created staging account;
only that account was granted active admin, with an audit record. The second
remains a participant. Future account/event permissions must be selectable via
operator/hosting-store management with explicit authority boundaries.

Free/no-prize two-player tournament 4c897051-f202-48a8-9822-377e9220f8b9
received both registrations through UI. Operator finalization froze room
3f791b01-efa0-4bba-ac6a-0e8630b9648c. Initial provision failed because a
manually seeded PostgreSQL microsecond timestamp was normalized to milliseconds
by JavaScript. While pristine/unbound, both event and manifest were truncated
to the SAME milliseconds without changing roster/room/checkpoint. Operator
retry bound the same room; assigned=true and two admissions were verified.
Do not reuse this expired schedule or mutate a running checkpoint to reset it.
Future manually seeded times must use JavaScript-compatible precision.

User screenshots confirmed both accounts could seat; then one disconnected and
background HTTP updates made connection controls blink every second. HTTP logs
showed successful room requests, but did not establish why that browser lost
connection. No live game/privacy/conservation/restart approval was recorded.
The user exited both views; gameplay verification is on hold.

Current frontend change separates background refresh from foreground busy state,
coalesces reads and ignores old read results after newer operations/session loss.
Transient read failures hide private state/actions, preserve the capability and
retry with 1–10 second backoff. 4xx auth/permission/conflict failures stop polling;
there is no automatic join/takeover or automatic action retry. WebSocket loss
still clears private state and requires explicit reconnect. Error status is
shown without tokens or server exception text. This addresses confirmed blink
and premature read-failure teardown, not a proven fix for every socket loss.

Validation: 401 Node tests, strict backend build, and React lifecycle checks
including delayed read, network/503 recovery and revoked-connection behavior.
Deployed stable two-account Auth/WSS gameplay and the dependency audit remain open.

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
The Next Preview needs staging public Auth keys, the server-only staging service
key used by login auditing, and fixed backend HTTPS/WSS origins. Scope Vercel settings to Preview and this Git branch; never
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

### 結果の確認時間（2026-10-19）
- サーバーのハンド間隔の標準値を4秒から8秒へ変更。旧標準値4秒の保存済みルームは復元時に8秒へ移行し、それ以外の明示設定値は維持する。
- 接続中に受信した直前の勝者・ハンド番号・各席の収支を、次ハンド中も結果欄に表示する。現在のカード・操作は最新のサーバー状態を使用する。
- 保持するのは結果の集計値のみ。手札や接続情報は履歴に保持せず、未接続・ログアウト・画面の再読み込みで消去する。永続的なハンド履歴の閲覧機能とは別。

### 手番とタイムバンク（2026-10-19）
- オンライン卓の手番アイコンにサーバー残り時間に連動する円形ゲージを表示。残り5秒で赤色。BB/SB/BTNは自分・対面席ではアイコンの左側へ分離する。
- タイムバンクはプレイヤーごとに1ハンド1回・20秒延長。自分の手番で期限前のみ使用可能。秒数や回数をクライアントから指定できない。
- 延長は認証・act権限・現行接続トークンを検証後、所有者FIFO内で保存する。同じハンド・手番の再送は延長済み結果を返し、二重消費しない。使用回数と期限は暗号化チェックポイントで維持し、次ハンドで回数を戻す。

### 大会成績・ブログ用集計（2026-10-19）
- `/mypage/poker`：自分の確定大会順位・通算1〜3位回数・参加予定／進行中大会・リング残高と自分の順位。
- `/admin/poker-statistics`：運営のみ、全員の通算成績・歴代順位・リング残高順位とCSV出力（各最大500件）。表示名・大会名はCSVの式実行を防止して出力。
- 終了したハンドの勝者ではなく、トーナメント優勝者が確定した時だけ大会結果を保存。大会IDを一意にし二重集計を防止。同額残高は競技順位（1,1,3位）。同率大会順位は開始順位の回数に含める。
- サーバー専用のハンド結果に、実際の席と会員IDの対応だけを追加する。これは非公開の保存領域であり、公開スナップショットやCSVに会員ID・手札・接続情報を追加しない。過去ログへの対応情報の補完は、同じゲーム結果を維持した一方向の更新だけ許可する。
- リング残高は読み取りモデルのみで、ゲームとの入出金・精算台帳は未接続。未作成の残高を0や仮順位として表示しない。大会チップから残高を生成しない。
- 終了後10分での退出・卓閉鎖、公の大会詳細結果ページはこの集計変更とは別工程で、まだ未実装。

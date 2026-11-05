# 退会時のGTO利用履歴の匿名化

2026-11-05 オーナー指示。新migration `20261105021924_withdraw_member_gto_usage.sql` をステージング、本番の順に適用済み。

- 本番の旧 `private.withdraw_member(uuid)` のprosrcと20261101110000版を完全一致で確認。
- 既存本体をそのまま継承し、poker_gto_practice_hands削除の直後に、テーブル存在確認＋該当member_idをnullにする3行だけ追加。
- ステージングには旧退会関数・ディーラー関連テーブルがなかったため、関数をmigrationで追加。周辺の欠損テーブルだけトランザクション内のfixtureで補い、通常削除・記録保持の匿名化の両経路を実行。テスト終了時にfixtureと会員を全てROLLBACK。
- ステージングテスト：利用履歴の行数・ID・日時・visitor・道具・動き・端末を保持、退会者2人のmember_idのみnull、他会員・既存匿名イベント不変。GTO判断/練習ハンドとHUDメモ削除、プロフィール削除、ディーラー匿名化、identity/session削除、保持記録の存続を確認。
- 本番でも実関数をトランザクション内のランダムUUIDの合成テスト会員で実行。会員削除・利用履歴匿名化・payload保持・他イベント不変を確認後に全ROLLBACK。本番の既存会員には退会処理を実行していない。
- 本番/ステージングの更新後prosrc MD5が共に `fa69099ad6889a573b6f9781de3ebc5f`。SECURITY DEFINER、空search_path、ACL `{postgres=X/postgres}`を維持。anon/authenticatedからの関数実行・利用履歴参照不可、service_roleのselect/insert権限を確認。セキュリティadvisors照会済み。
- migration自体は関数定義だけの変更。過去イベントの一括更新や既存データのバックフィルは行わない。

SQLの回帰検証はtests/sql/withdraw-member-gto-usage.sql（ステージング専用）とwithdraw-member-gto-usage-production.sql。どちらも自前fixtureだけを使いROLLBACKする。元関数本体の完全保持と追加位置はtests/gto-usage.test.cjsでも検証。

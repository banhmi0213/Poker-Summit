# ロビーデザインの引き継ぎ（2026/10/29）

承認済みのシャンパンベージュ／ネイビーのサンプルを、`/poker-lobby` に実装。
左メニュー、上の3枚、中央の卓一覧、右のランキング・優勝者という配置を固定し、画面幅に応じて縦積みにする。

- リング一覧の見た目は `app/poker-lobby/ring-lobby-list.tsx`。既存の `RingAdmissionPanel` に `lobbyLayout="list"` を渡すだけで、同じ着席・観戦・未確認操作の保護を使う。
- `onLobbyState` は読み取り済みの状態を上の参加卓カードへ渡す表示用コールバック。送信・精算・再試行の処理は変更していない。
- 上の残高カードは既存 `SummitChipBalance` の `presentation="lobby"`。残高・順位・補充処理は既存と同じ。
- 練習卓は既存プレビューの `practiceOnly`。会員リングと分離する。デモ人数は既存のサンプル値。
- 大会の受付と割り当て卓は既存部品をそのまま使用。公開スイッチがオフの場合は大会タブ・受付を出さない。
- 卓・カード・裏面の選択は既存 `SkinSettings` と `TablePreferences` を使用。無料公開中の表示を守り、交換所は `/mypage/chips` へつなぐ。

## Claude に接続してほしい公開データ

現在の `poker_statistics(false)` は本人の記録のみ。`true` は管理者限定なので、ロビーで使わない。
会員全体の持ちチップ順位と歴代優勝者を読む会員向け API は未接続のため、右の欄と詳細画面は「公開準備中」と明記。
仮の名前・残高・優勝記録を本物として表示していない。

公開用 API ができたら `RecordPlaceholder` を実データに差し替える。右欄は上位3名、メニューの詳細はページ切り替え式で一覧。
希望する返却値（契約案。DB/APIをこの変更では作成していない）:

```ts
type LeaderboardRow = { memberId: string; name: string; avatarUrl: string|null; rank: number; total: number };
type ChampionRow = { tournamentId: string; title: string; finishedAt: string; memberId: string; name: string; avatarUrl: string|null };
```

順位は本人の残高カードと同じ集計定義に揃える。優勝記録は確定大会のみ。練習卓の結果を混ぜない。
表示名は公開用表示名のみ、メールアドレス・内部管理情報は返さない。
チップ処理、DB、`lib/poker/ring-*`、本番mainは変更しない。

# Poker Summit 開発メモ

## デザインのルール（オーナー指示）
- ボタンの文言に矢印（→ ↓ ↗ など）を付けない（2026/10/19 指示）。新しくボタンを作るときも矢印なし。
- リンクの文言（「〜を見る」「次へ」「前へ」「〜に戻る」、外部サイトへのリンクなど）にも矢印を付けない（2026/10/21 指示）。文中で順番や変化を表す矢印（例：UTG → HJ）と、文字のない並べ替え・ページ上部へのアイコンボタンは別。
- 既存のデザインを崩さない。文言・項目を変えるときも見た目の雰囲気は維持する。

## 料金表示のルール（オーナー指示）
- 店舗向けの画面・メール・請求書には、その店の地域の料金だけを出す。他の地域の料金（地域PICKUPの「東京・大阪・福岡は◯円／その他は◯円」など）は絶対に出さない（2026/10/21 指示）。並べて出すのは運営の管理画面だけ。

## 修正を本番に反映する手順
本番は https://pokersummit.jp のみ（運営確認用 pokersummit-staff.vercel.app は 2026/11/06 オーナー指示で不要。付け替えしない）。
1. staging ブランチ `chatgpt/poker-authoritative-hand` に push（main へ直接 push してもよい）。
2. staging から入れた場合は main への PR を merge（GitHub は REST API：`gh api repos/banhmi0213/Poker-Summit/pulls/<番号>/merge -X PUT -f merge_method=merge`）。main に入ると本番に自動で出る。
   - 「Poker engine regression tests」が chromium の `Cannot find module` で落ちるのは CI 環境の一時的な失敗。フロントだけの修正なら Vercel が success なら merge してよい。
3. Vercel（team `team_enzgtM1j8Cn1ais7W0AW7P5H` / project `prj_EzG5dJ1AEulROqyi25CAKKuoWISW`）で main の最新 production デプロイが READY になったら、本番のページを開いて確認。

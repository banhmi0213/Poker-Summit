# ホーム画面対応

- 375px / 320px: Safari向け案内、44px以上の閉じるボタン、横はみ出しなし。
- 閉じた後に再読み込みしても案内が再表示されないことを実Chromiumで確認。
- 1280px: 案内を表示せずPCレイアウトを維持。
- manifest: standalone / Poker Summit / 192px・512pxアイコン。
- iPhone apple-iconは180px。appleWebApp capable設定を維持。
- 紺のtheme色とviewport-fit=cover、standaloneのヘッダーsafe-areaを設定。

添付画像は実コンポーネントをローカルの固定データで表示した通常タブの検証画像。iPhone実機やホーム画面からの起動画像ではない。
ホーム画面から起動した証拠画像と実機safe-areaの最終確認は未完了。確認完了までこのPRはdraftで保持。

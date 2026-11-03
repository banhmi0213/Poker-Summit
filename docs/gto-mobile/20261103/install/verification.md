# ホーム画面対応

- 375px / 320px: Safari向け案内、44px以上の閉じるボタン、横はみ出しなし。
- 閉じた後に再読み込みしても案内が再表示されないことを実Chromiumで確認。
- 1280px: 案内を表示せずPCレイアウトを維持。
- manifest: standalone / Poker Summit / 192px・512pxアイコン。
- iPhone apple-iconは180px。appleWebApp capable設定を維持。
- 紺のtheme色とviewport-fit=cover、standaloneのヘッダーsafe-areaを設定。

添付画像は実コンポーネントをローカルの固定データで表示した通常タブの検証画像。iPhone実機やホーム画面からの起動画像ではない。
375px / 320pxで上44px・下34pxのsafe-areaを仮定し、実CSSのstandaloneルールを有効化した画像を追加。ヘッダーのリンクと全画面の閉じるボタンが上44pxに重ならず、横はみ出しがないことを確認。この画像は模擬検証であり実ホーム起動画像ではない。

オーナーの11/3訂正指示により、この範囲の確認と全チェック成功後にステージングへマージする。実際のホーム画面から起動した見た目はマージ後にオーナーのiPhoneで確認する。

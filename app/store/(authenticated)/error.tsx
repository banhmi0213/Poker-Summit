"use client";

// 店舗管理画面で保存に失敗したときの画面(2026/10)。
// 本番ではサーバー側のエラー文がそのまま表示されない(Next.jsの仕様)ため、よくある原因を案内する。
export default function StoreAdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container" style={{ maxWidth: 640, padding: "40px 16px" }}>
      <div className="card" style={{ lineHeight: 1.9 }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>保存できませんでした</h1>
        <p>お手数ですが、入力内容をご確認のうえ、もう一度お試しください。よくある原因は次のとおりです。</p>
        <ul style={{ margin: "8px 0 16px 1.2em" }}>
          <li>必須の項目(タイトル・名前など)が空欄になっている</li>
          <li>「換金」「現金化」など、掲載できない言葉が含まれている</li>
          <li>現在のプランで登録できる件数を超えている</li>
        </ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => history.back()}>入力画面に戻る</button>
          <button className="btn" onClick={() => reset()}>再読み込み</button>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>解決しない場合は、お問い合わせフォームからご連絡ください。</p>
      </div>
    </div>
  );
}

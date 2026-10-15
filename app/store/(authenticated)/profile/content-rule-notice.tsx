/** 店舗管理画面の投稿フォームの上に出す、掲載ルールの案内 */
export function StoreContentRuleNotice() {
  return (
    <div
      className="card"
      style={{ marginBottom: 16, background: "#fff7f5", borderColor: "#e8b4a8", fontSize: 13.5, lineHeight: 1.8 }}
    >
      <strong>⚠ 掲載ルール</strong>
      <br />
      Poker Summit はアミューズメントポーカーの情報サイトです。<strong>換金・現金化</strong>や、賭博を思わせる記載は掲載できません。
      違反が確認された場合は、予告なく掲載を停止します。
    </div>
  );
}

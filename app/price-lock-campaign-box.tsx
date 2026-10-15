import Link from "next/link";

// 申込画面の「年内お申込み特典」の枠(2026/10)。文面は運営と確定したもの。
export function PriceLockCampaignBox({ deadlineLabel }: { deadlineLabel: string }) {
  return (
    <div
      role="note"
      style={{
        border: "2px solid #d4a73c",
        background: "linear-gradient(135deg,#fff8e6,#fffdf7)",
        borderRadius: 12,
        padding: "14px 16px",
        margin: "0 0 14px",
        lineHeight: 1.75,
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 15, color: "#7a5512" }}>【年内お申込み特典】</p>
      <p style={{ margin: "0 0 8px", fontSize: 14 }}>
        {deadlineLabel}までにご契約いただいた店舗様は、今後料金を改定した場合も、ご契約時のプラン料金のまま据え置きます。
      </p>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 12, color: "#6b5a3e" }}>
        <li>※初回にご契約のプランに限ります。</li>
        <li>※プランの変更（アップ・ダウン）、お支払いの遅延（猶予期間を過ぎた未払い）、解約があった場合は対象外となり、以降は改定後の料金となります。</li>
        <li>※消費税率の変更分は除きます。</li>
      </ul>
      <p style={{ margin: "8px 0 0", fontSize: 12 }}>
        <Link href="/terms#price-lock" style={{ textDecoration: "underline" }}>詳しい条件（利用規約）</Link>
      </p>
    </div>
  );
}

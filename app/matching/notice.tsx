import Link from "next/link";

export function MatchingRulesNotice() {
 return <aside aria-label="スポット勤務のご利用ルール" style={{ padding: "14px 18px", margin: "18px 0", border: "1px solid #e5d4b8", borderRadius: 10, background: "#faf6ed", color: "#513916", fontSize: 13, lineHeight: 1.8 }}>
  <strong>安心してご利用いただくために</strong>
  <div>勤務条件・報酬・支払方法は当事者で確認してください。手続きを回避する外部誘導やハラスメントは禁止しています。</div>
  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginTop: 4 }}><Link href="/terms#dealer-matching" target="_blank" rel="noopener noreferrer">利用規約</Link><Link href="/contact">問題を相談する</Link></div>
 </aside>;
}

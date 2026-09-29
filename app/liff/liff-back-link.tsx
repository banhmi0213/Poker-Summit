import Link from "next/link";

export function LiffBackLink() {
  return (
    <Link href="/liff" className="muted" style={{ fontSize: 13, display: "inline-block", marginBottom: 12 }}>
      ← メニューに戻る
    </Link>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "退会手続きが完了しました｜Poker Summit",
  robots: { index: false },
};

// 退会直後に表示するページ(2026/10)。先行登録モード中も表示する(middleware の例外に追加)
export default function WithdrawnPage() {
  return (
    <div className="container" style={{ maxWidth: 520, padding: "56px 16px", textAlign: "center" }}>
      <img src="/images/logo.webp" alt="Poker Summit" style={{ width: "min(240px, 70%)", height: "auto", margin: "0 auto 24px", display: "block" }} />
      <h1 style={{ fontSize: 22, marginBottom: 14 }}>退会手続きが完了しました</h1>
      <div className="card" style={{ textAlign: "left", lineHeight: 1.9, fontSize: 14 }}>
        <p>これまでPoker Summitをご利用いただき、ありがとうございました。</p>
        <p style={{ marginTop: 8 }}>
          アカウントは削除され、ログインできなくなりました。同じメールアドレスで、いつでも新しく会員登録していただけます。
        </p>
      </div>
      <p style={{ marginTop: 20 }}>
        <Link href="/">トップページへ</Link>
      </p>
    </div>
  );
}

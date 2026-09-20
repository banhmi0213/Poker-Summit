import Link from "next/link";
import { submitInquiry } from "./actions";

export default function ContactPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const params = searchParams;

  return (
    <div>
      <header className="header">
        <Link href="/" className="brand">
          Poker Summit
        </Link>
      </header>
      <div className="container" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>お問い合わせ</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          ご質問・ご要望などございましたら、以下のフォームよりお問い合わせください。
        </p>

        {params.done ? (
          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              お問い合わせありがとうございます
            </h2>
            <p className="muted">
              内容を確認のうえ、担当者よりご連絡いたします。
            </p>
            <Link href="/" className="btn" style={{ marginTop: 16, display: "inline-flex" }}>
              トップへ戻る
            </Link>
          </div>
        ) : (
          <div className="card">
            {params.error && <p className="err">{params.error}</p>}
            <form action={submitInquiry}>
              <div className="field">
                <span className="muted">お名前 *</span>
                <input type="text" name="name" required />
              </div>
              <div className="field">
                <span className="muted">メールアドレス *</span>
                <input type="email" name="email" required />
              </div>
              <div className="field">
                <span className="muted">電話番号</span>
                <input type="tel" name="tel" />
              </div>
              <div className="field">
                <span className="muted">件名</span>
                <input type="text" name="subject" />
              </div>
              <div className="field">
                <span className="muted">お問い合わせ内容 *</span>
                <textarea name="message" rows={5} required />
              </div>
              <button type="submit" className="btn primary" style={{ width: "100%" }}>
                送信する
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

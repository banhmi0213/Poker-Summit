import Link from "next/link";
import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { requestPasswordReset } from "./actions";

export const metadata: Metadata = { ...NOINDEX, title: "パスワードの再設定｜Poker Summit" };

export default function ForgotPasswordPage({ searchParams }: { searchParams: { error?: string; sent?: string; from?: string } }) {
  const fromAdmin = searchParams.from === "admin";
  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 60 }}>
      <div className="auth-brand-wrap" style={{ margin: "0 0 20px" }}>
        <div className="brand wordmark">
          <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
        </div>
      </div>
      <div className="card">
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>パスワードの再設定</h1>
        {searchParams.sent ? (
          <p style={{ lineHeight: 1.9 }}>
            ご入力のメールアドレスが登録されている場合、パスワード再設定用のリンクを info@pokersummit.jp からお送りしました。
            メール内のリンクを開いて、新しいパスワードを設定してください（有効期限60分）。
            <br />
            <span className="muted" style={{ fontSize: 12.5 }}>届かない場合は迷惑メールフォルダもご確認ください。</span>
          </p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
              登録したメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            {searchParams.error && <p className="err">{searchParams.error}</p>}
            <form action={requestPasswordReset}>
              <input type="hidden" name="from" value={fromAdmin ? "admin" : "member"} />
              <label className="field">
                <span>メールアドレス</span>
                <input type="email" name="email" required autoComplete="email" />
              </label>
              <button type="submit" className="btn primary" style={{ width: "100%" }}>
                再設定メールを送る
              </button>
            </form>
          </>
        )}
        <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
          <Link href={fromAdmin ? "/admin-login" : "/login"}>ログイン画面に戻る</Link>
        </p>
        <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
          店舗管理画面のパスワードは、運営事務局へお問い合わせください。
        </p>
      </div>
    </div>
  );
}

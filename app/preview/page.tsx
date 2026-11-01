import { PasswordInput } from "@/app/password-input";
import { previewSignIn } from "./actions";
import { previewConfigured } from "@/lib/preview-access";

export const metadata = { title: "閲覧用ログイン｜Poker Summit", robots: { index: false, follow: false } };

// 先行登録期間中に、招待した方がサイトの中身を見るためのログイン画面(2026/10)
export default function PreviewLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="container public-login" style={{ maxWidth: 380, padding: "48px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img src="/images/logo.webp" alt="Poker Summit" style={{ width: 220, maxWidth: "70%", height: "auto" }} />
      </div>
      <div className="card">
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>閲覧用ログイン</h1>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, marginBottom: 16 }}>オープン前のサイトを、お知らせしたログインIDとパスワードでご覧いただけます。</p>
        {searchParams.error && <p className="err" role="alert">ログインIDまたはパスワードが違います。</p>}
        {!previewConfigured() && <p className="err">現在、閲覧用ログインは受け付けていません。</p>}
        <form action={previewSignIn}>
          <label className="field"><span>ログインID</span><input type="text" name="loginId" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          <label className="field"><span>パスワード</span><PasswordInput name="password" required autoComplete="current-password" enterKeyHint="go" /></label>
          <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center", minHeight: 48, fontSize: 15 }}>サイトを見る</button>
        </form>
      </div>
    </main>
  );
}

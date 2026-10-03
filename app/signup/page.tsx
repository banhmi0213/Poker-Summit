import Link from "next/link";
import { signUp } from "./actions";
import { PREF_OPTIONS } from "@/lib/constants";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const params = searchParams;

  return (
    <div>
      <PortalHeader />
      <div className="container" style={{ maxWidth: 380 }}>
      <Link href="/" className="breadcrumb">
        ← トップに戻る
      </Link>
      <div className="auth-brand-wrap" style={{ margin: "0 0 20px" }}>
        <div className="brand wordmark">
          <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
        </div>
      </div>

      {params.done ? (
        <div className="card">
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>
            確認メールをお送りしました
          </h1>
          <p className="muted">
            メール内のリンクから登録を完了してください。
          </p>
          <Link href="/login" className="btn" style={{ marginTop: 16, display: "inline-flex" }}>
            ログインへ
          </Link>
        </div>
      ) : (
        <div className="card">
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>会員登録</h1>
          <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
            会員登録すると、お気に入り登録・求人応募・クーポン利用・イベント参加登録ができるようになります。
          </p>
          {params.error && <p className="err">{params.error}</p>}
          <form action={signUp}>
            <div className="field">
              <span className="muted">ハンドルネーム</span>
              <input type="text" name="name" autoComplete="nickname" />
            </div>
            <div className="field">
              <span className="muted">都道府県</span>
              <select name="pref" defaultValue="" required>
                <option value="" disabled>
                  選択してください
                </option>
                {PREF_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {/* 都道府県の公開設定(2026/10、「会員登録時都道府県を非公開に
                できるようにして」との指示)。他の会員から見える会員プロフィール
                ページ(/members/[id])に出すかどうかを選べる。 */}
            <div className="field">
              <span className="muted">都道府県の公開設定</span>
              <select name="prefPublic" defaultValue="public">
                <option value="public">公開（他の会員にも表示）</option>
                <option value="private">非公開（自分だけに表示）</option>
              </select>
            </div>
            <div className="field">
              <span className="muted">メールアドレス</span>
              <input type="email" name="email" required autoComplete="email" />
            </div>
            <div className="field">
              <span className="muted">パスワード（6文字以上）</span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn primary" style={{ width: "100%" }}>
              登録する
            </button>
          </form>
          <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
            すでにアカウントをお持ちの方は<Link href="/login">こちらからログイン</Link>
          </p>
        </div>
      )}
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

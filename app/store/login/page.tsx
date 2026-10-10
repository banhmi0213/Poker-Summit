import { ManagementLoginForm } from "@/app/management-login-form";
import Link from "next/link";
import { storeSignIn } from "./actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

// 会員ログイン(/login, メールアドレス)と店舗管理ログイン(ログインID)は
// 見た目も入力形式も別物なのに1つの画面に無理に同居させていた
// (2026/09/30、メールアドレス欄にログインIDを入れさせる形になっていて
// 分かりにくいとの指摘を受け分離)。店舗オーナーはここから、発行された
// ログインID("store-xxxxxxxx")とパスワードでログインする。
export default function StoreLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const params = searchParams;
  const next = params.next ?? "";

  return (
    <div>
      <PortalHeader />
      <div className="container" style={{ maxWidth: 380 }}>
        <Link href="/" className="breadcrumb">
          ← トップに戻る
        </Link>
        <div className="auth-brand-wrap" style={{ margin: "0 0 20px" }}>
          <div className="brand wordmark">
            <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
          </div>
        </div>
        <div className="card">
          <h1 style={{ fontSize: 18, marginBottom: 4 }}>店舗管理ログイン</h1>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            店舗の掲載申込み・発行時にお伝えしたログインIDとパスワードでログインしてください。
          </p>
          {params.error && <p className="err">{params.error}</p>}
          <ManagementLoginForm action={storeSignIn}>
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <span className="muted">ログインID</span>
              <input
                type="text"
                name="loginId"
                placeholder="例: store-xxxxxxxx"
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <span className="muted">パスワード</span>
              <input
                type="password"
                name="password"
                enterKeyHint="go"
                required
                autoComplete="current-password"
              />
            </div>
          </ManagementLoginForm>
          <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
            ログインIDが分からない場合は運営までお問い合わせください。
          </p>
          <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
            会員の方は<Link href="/login">こちらから会員ログイン</Link>
          </p>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

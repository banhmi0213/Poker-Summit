import Link from "next/link";
import { signIn } from "./actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = { ...NOINDEX, title: "ログイン｜Poker Summit" };

export default function LoginPage({
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
            <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
          </div>
        </div>
        <div className="card">
          {params.error && <p className="err">{params.error}</p>}
          <form action={signIn}>
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <span className="muted">メールアドレス</span>
              <input type="email" name="email" required autoComplete="email" />
            </div>
            <div className="field">
              <span className="muted">パスワード</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn primary" style={{ width: "100%" }}>
              ログイン
            </button>
          </form>
          <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
            会員登録がまだの方は<Link href="/signup">こちらから登録</Link>
          </p>
          <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
            店舗の方は<Link href="/store/login">こちらから店舗管理ログイン</Link>
          </p>
          <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
            運営の方は<Link href="/admin-login">こちらから総合管理ログイン</Link>
          </p>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

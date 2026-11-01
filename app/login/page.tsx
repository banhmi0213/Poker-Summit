import Link from "next/link";
import { MemberLoginForm } from "./member-login-form";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo";

export const metadata: Metadata = staticPageMetadata({ title: "会員ログイン", description: "Poker Summitの会員ログイン。マイページからお気に入り店舗や応募状況、プロフィールを確認できます。", path: "/login" });

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
      <div className="container public-login" style={{ maxWidth: 380 }}>
        <Link href="/" className="breadcrumb">
          トップに戻る
        </Link>
        <div className="auth-brand-wrap" style={{ margin: "0 0 20px" }}>
          <div className="brand wordmark">
            <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
          </div>
        </div>
        <div className="card">
          {params.error && <p className="err">{params.error}</p>}
          <h1 style={{ fontSize: 20, marginBottom: 16 }}>会員ログイン</h1>
          <MemberLoginForm next={next} />
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5, textAlign: "right" }}>
            <Link href="/login/forgot">パスワードを忘れた方</Link>
          </p>
          <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
            会員登録がまだの方は<Link href="/signup">こちらから登録</Link>
          </p>
        </div>
      </div>
      <PortalFooter hideManagementLinks />
      <BottomTabs />
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/stores");
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div>
      <header
        className="header"
        style={{ flexWrap: "wrap", gap: 12, rowGap: 10 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div className="brand">Poker Summit 管理画面</div>
          {adminRow && (
            <nav style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/admin" className="muted">
                ダッシュボード
              </Link>
              <Link href="/admin/analytics" className="muted">
                アクセス分析
              </Link>
              <Link href="/admin/stores" className="muted">
                店舗管理
              </Link>
              <Link href="/admin/listing-applications" className="muted">
                掲載申込
              </Link>
              <Link href="/admin/jobs" className="muted">
                求人管理
              </Link>
              <Link href="/admin/events" className="muted">
                イベント管理
              </Link>
              <Link href="/admin/coupons" className="muted">
                クーポン管理
              </Link>
              <Link href="/admin/board" className="muted">
                掲示板管理
              </Link>
              <Link href="/admin/reports" className="muted">
                通報管理
              </Link>
              <Link href="/admin/banners" className="muted">
                バナー管理
              </Link>
              <Link href="/admin/members" className="muted">
                会員管理
              </Link>
              <Link href="/admin/inquiries" className="muted">
                お問い合わせ
              </Link>
              <Link href="/admin/admins" className="muted">
                運営ユーザー
              </Link>
              <Link href="/admin/audit-log" className="muted">
                操作ログ
              </Link>
              <Link href="/admin/ng-words" className="muted">
                NGワード
              </Link>
              <Link href="/admin/settings" className="muted">
                サイト設定
              </Link>
              <Link href="/admin/system" className="muted">
                システム
              </Link>
            </nav>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/account/password" className="btn">
            パスワード変更
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn">
              ログアウト ({user.email})
            </button>
          </form>
        </div>
      </header>
      <div className="container">
        {adminRow ? (
          children
        ) : (
          <p className="err">
            このアカウントには運営権限がありません。管理者に admin_users
            テーブルへの登録を依頼してください。
          </p>
        )}
      </div>
    </div>
  );
}

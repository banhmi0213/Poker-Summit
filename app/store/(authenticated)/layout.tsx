import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { storeSignOut } from "@/app/store/login/actions";
import { StoreSidebar } from "./store-sidebar";

// このレイアウトは (authenticated) ルートグループ配下にあり、URLには
// 影響しない(/store/profile 等はそのまま)。以前は app/store/layout.tsx
// として /store/* 全体(/store/login含む)を覆っていたため、未ログイン
// 時に /store/login 自身もこのガードに引っかかり、
// /store/login → /store/login?next=/store/profile の無限リダイレクト
// になっていた不具合(2026/09/30)。/store/login を兄弟ディレクトリ
// (app/store/login, このグループの外)に出すことで解消した。

export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile");
  }

  // user.emailは内部的なダミーアドレス("loginId@login.poker-summit.jp")
  // なので、店舗オーナーには馴染みのある「発行したログインID」部分だけを
  // 表示する(@より前)。
  const loginId = user.email?.split("@")[0] ?? "";

  return (
    <div className="app-shell">
      <StoreSidebar />
      <div className="app-main">
        <div className="app-topbar" style={{ justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {/* 会員・総合管理画面用の/account/password(デフォルトCookie)
                ではなく、店舗用Cookieのセッションを更新できる専用ページ
                を使う(2026/09/30、店舗/管理者セッション分離に伴う変更)。 */}
            <Link href="/store/profile/password" className="btn">
              パスワード変更
            </Link>
            <form action={storeSignOut}>
              <button type="submit" className="btn">
                ログアウト ({loginId})
              </button>
            </form>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

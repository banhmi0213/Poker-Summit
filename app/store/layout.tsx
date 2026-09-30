import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { storeSignOut } from "@/app/store/login/actions";
import { StoreSidebar } from "./store-sidebar";

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
            <Link href="/account/password" className="btn">
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

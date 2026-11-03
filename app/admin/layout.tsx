import { NOINDEX } from "@/lib/seo";
export const metadata = NOINDEX;
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { AdminSidebar } from "./admin-sidebar";

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
    redirect("/admin-login?next=/admin/stores");
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return (
      <div className="container">
        <p className="err">
          このアカウントには運営権限がありません。管理者用アカウントでログインしてください。
        </p>
        <p>現在ログイン中：{user.email}</p>
        <p><Link className="btn" href="/admin-login?next=/admin/poker-statistics">管理者アカウントでログイン</Link> <Link className="btn" href="/poker-lobby">ポーカーロビーへ戻る</Link></p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AdminSidebar />
      <div className="app-main">
        <div className="app-topbar" style={{ justifyContent: "flex-end" }}>
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
        </div>
        {children}
      </div>
    </div>
  );
}

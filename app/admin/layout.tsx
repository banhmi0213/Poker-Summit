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
            <nav style={{ display: "flex", gap: 14 }}>
              <Link href="/admin/stores" className="muted">
                店舗管理
              </Link>
              <Link href="/admin/listing-applications" className="muted">
                掲載申込
              </Link>
            </nav>
          )}
        </div>
        <form action={signOut}>
          <button type="submit" className="btn">
            ログアウト ({user.email})
          </button>
        </form>
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

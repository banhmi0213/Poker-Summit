import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { setStoreStatus } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  listed: "掲載済み",
};

export default async function AdminStoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (!adminRow) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p className="err">
          このアカウントには運営権限がありません。管理者に admin_users
          テーブルへの登録を依頼してください。
        </p>
        <p className="muted">ログイン中: {user?.email}</p>
        <form action={signOut}>
          <button type="submit" className="btn">
            ログアウト
          </button>
        </form>
      </div>
    );
  }

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, category, region, pref, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="container">
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 22 }}>店舗管理</h1>
        <form action={signOut}>
          <button type="submit" className="btn">
            ログアウト ({user?.email})
          </button>
        </form>
      </header>

      <table>
        <thead>
          <tr>
            <th>店舗名</th>
            <th>エリア</th>
            <th>ステータス</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {stores?.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{[s.region, s.pref].filter(Boolean).join(" / ")}</td>
              <td>
                <span className="badge">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <form
                    action={async () => {
                      "use server";
                      await setStoreStatus(s.id, "approved");
                    }}
                  >
                    <button type="submit" className="btn primary">
                      承認
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await setStoreStatus(s.id, "rejected");
                    }}
                  >
                    <button type="submit" className="btn">
                      却下
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

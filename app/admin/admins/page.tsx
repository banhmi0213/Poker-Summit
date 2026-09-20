import { createClient } from "@/lib/supabase/server";
import { addAdminByEmail, removeAdmin } from "./actions";

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("ja-JP");
}

export default async function AdminAdminsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members, error } = await supabase.rpc("admin_list_members");
  const admins = members?.filter((m: any) => m.is_admin) ?? [];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>管理者アカウント管理</h1>

      {error && <p className="err">{error.message}</p>}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>管理者を追加</h2>
        <form action={addAdminByEmail} style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            name="email"
            placeholder="追加するユーザーのメールアドレス"
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn primary">
            追加する
          </button>
        </form>
        <p className="muted" style={{ marginTop: 8 }}>
          ※ 追加できるのは、すでにアカウント登録済みのユーザーのみです。
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>メールアドレス</th>
            <th>登録日</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a: any) => (
            <tr key={a.id}>
              <td>{a.email}</td>
              <td>{formatDate(a.created_at)}</td>
              <td>
                {a.id === user?.id ? (
                  <span className="muted">自分自身</span>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await removeAdmin(a.id);
                    }}
                  >
                    <button type="submit" className="btn">
                      権限を削除
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

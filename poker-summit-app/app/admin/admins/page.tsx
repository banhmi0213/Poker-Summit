import { createClient } from "@/lib/supabase/server";
import { addAdminByEmail, removeAdmin, setAdminRole, setAdminActive } from "./actions";

const STAFF_ROLES = [
  { value: "super_admin", label: "管理者(全権限)" },
  { value: "editor", label: "編集者" },
  { value: "support", label: "サポート担当" },
];

function roleLabel(role: string | null) {
  return STAFF_ROLES.find((r) => r.value === role)?.label ?? role ?? "";
}

function roleBadge(role: string | null) {
  const label = roleLabel(role);
  return role === "super_admin" ? (
    <span className="badge accent">{label}</span>
  ) : (
    <span className="badge outline">{label}</span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ja-JP");
}

export default async function AdminAdminsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members, error } = await supabase.rpc("admin_list_members");
  let admins = (members ?? []).filter((m: any) => m.is_admin);
  if (q) {
    admins = admins.filter((a: any) => a.email?.toLowerCase().includes(q.toLowerCase()));
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>運営ユーザー</h1>

      {error && <p className="err">{error.message}</p>}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>運営ユーザーを追加</h2>
        <form action={addAdminByEmail} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            name="email"
            placeholder="追加するユーザーのメールアドレス"
            required
            style={{ flex: "1 1 220px" }}
          />
          <select name="role" defaultValue="support" style={{ flex: "0 0 160px" }}>
            {STAFF_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn primary">
            追加する
          </button>
        </form>
        <p className="muted" style={{ marginTop: 8 }}>
          ※ 追加できるのは、すでにアカウント登録済みのユーザーのみです。
        </p>
      </div>

      <form method="get" style={{ marginBottom: 14 }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="メールアドレスで検索"
          style={{ maxWidth: 260 }}
        />
      </form>

      <table>
        <thead>
          <tr>
            <th>メールアドレス</th>
            <th>権限</th>
            <th>最終ログイン</th>
            <th>登録日</th>
            <th>ステータス</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {admins.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                運営ユーザーがいません。
              </td>
            </tr>
          )}
          {admins.map((a: any) => (
            <tr key={a.id}>
              <td>{a.email}</td>
              <td>{roleBadge(a.admin_role)}</td>
              <td>{formatDate(a.last_sign_in_at)}</td>
              <td>{formatDate(a.created_at)}</td>
              <td>
                {a.admin_active ? (
                  <span className="badge good">✓ 有効</span>
                ) : (
                  <span className="badge outline">無効</span>
                )}
              </td>
              <td>
                {a.id === user?.id ? (
                  <span className="muted">自分自身</span>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        await setAdminRole(a.id, String(formData.get("role")));
                      }}
                      style={{ display: "flex", gap: 4 }}
                    >
                      <select name="role" defaultValue={a.admin_role ?? "support"}>
                        {STAFF_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        変更
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await setAdminActive(a.id, !a.admin_active);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        {a.admin_active ? "無効化" : "有効化"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await removeAdmin(a.id);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        削除
                      </button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

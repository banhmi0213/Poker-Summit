import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("ja-JP");
}

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data: members, error } = await supabase.rpc("admin_list_members");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>会員管理</h1>

      {error && <p className="err">{error.message}</p>}

      <table>
        <thead>
          <tr>
            <th>メールアドレス</th>
            <th>登録日</th>
            <th>種別</th>
            <th>紐づく店舗</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {members?.map((m: any) => (
            <tr key={m.id}>
              <td>{m.email}</td>
              <td>{formatDate(m.created_at)}</td>
              <td>
                {m.is_admin && <span className="badge">運営</span>}
                {m.store_id && !m.is_admin && (
                  <span className="badge">店舗オーナー</span>
                )}
                {!m.is_admin && !m.store_id && (
                  <span className="muted">一般</span>
                )}
              </td>
              <td>{m.store_name ?? ""}</td>
              <td>
                {m.suspended ? (
                  <span
                    className="badge"
                    style={{ background: "rgba(230, 80, 80, 0.14)", color: "var(--critical)" }}
                  >
                    利用停止中
                  </span>
                ) : (
                  <span className="muted">通常</span>
                )}
              </td>
              <td>
                <Link href={`/admin/members/${m.id}`} className="btn" style={{ fontSize: 12 }}>
                  詳細
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

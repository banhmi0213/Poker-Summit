import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AdminAuditLogPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>操作ログ</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        直近200件の管理操作を新しい順に表示しています。
      </p>

      <table>
        <thead>
          <tr>
            <th>日時</th>
            <th>操作者</th>
            <th>操作</th>
            <th>対象</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          {logs?.map((l) => (
            <tr key={l.id}>
              <td>{formatDate(l.created_at)}</td>
              <td>{l.actor_email ?? "-"}</td>
              <td>{l.action}</td>
              <td>
                {l.target_type ? `${l.target_type}` : ""}
                {l.target_id ? ` #${String(l.target_id).slice(0, 8)}` : ""}
              </td>
              <td className="muted" style={{ fontSize: 12 }}>
                {l.detail ? JSON.stringify(l.detail) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

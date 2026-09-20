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

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: { q?: string; from?: string; to?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q?.trim() ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (q) {
    query = query.or(`actor_email.ilike.%${q}%,action.ilike.%${q}%,target_type.ilike.%${q}%`);
  }

  const { data: logs } = await query;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>操作ログ</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        直近200件の管理操作を新しい順に表示しています。
      </p>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="実行者・アクション・対象で検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 240,
          }}
        />
        <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
          <span className="muted">日時 from</span>
          <input type="date" name="from" defaultValue={from} style={{ maxWidth: 160 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
          <span className="muted">日時 to</span>
          <input type="date" name="to" defaultValue={to} style={{ maxWidth: 160 }} />
        </label>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

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

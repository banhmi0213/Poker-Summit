import { createClient } from "@/lib/supabase/server";
import { setJobStatus, deleteJob } from "./actions";

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q ?? "";
  const status = searchParams.status ?? "all";

  let query = supabase
    .from("jobs")
    .select("id, title, job_type, salary, status, posted_at, store_id, stores(name)")
    .order("posted_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: jobs } = await query;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>求人管理（全店舗）</h1>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="求人タイトルで検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 220,
          }}
        />
        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
          }}
        >
          <option value="all">すべて</option>
          <option value="open">募集中</option>
          <option value="closed">終了</option>
        </select>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      {(!jobs || jobs.length === 0) && <p className="muted">該当する求人はありません。</p>}

      {jobs && jobs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>店舗</th>
              <th>求人タイトル</th>
              <th>雇用形態</th>
              <th>給与</th>
              <th>ステータス</th>
              <th>掲載日</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j: any) => (
              <tr key={j.id}>
                <td>{j.stores?.name ?? ""}</td>
                <td>{j.title}</td>
                <td>{j.job_type ?? ""}</td>
                <td>{j.salary ?? ""}</td>
                <td>
                  <span className="badge">{j.status === "open" ? "募集中" : "終了"}</span>
                </td>
                <td>{j.posted_at ? String(j.posted_at).slice(0, 10) : ""}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <form
                      action={async () => {
                        "use server";
                        await setJobStatus(j.id, j.status === "open" ? "closed" : "open");
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        {j.status === "open" ? "募集終了" : "募集再開"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deleteJob(j.id);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        削除
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

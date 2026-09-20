import { createClient } from "@/lib/supabase/server";
import { setJobStatus, deleteJob, createJobByAdmin, updateJobByAdmin } from "./actions";
import { JOB_TYPE_OPTIONS } from "@/lib/constants";

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q ?? "";
  const status = searchParams.status ?? "all";

  const { data: allStores } = await supabase
    .from("stores")
    .select("id, name")
    .order("name", { ascending: true });

  let query = supabase
    .from("jobs")
    .select("id, title, job_type, salary, status, posted_at, store_id, stores(name)")
    .order("posted_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    const matchingStoreIds = (allStores ?? [])
      .filter((s) => s.name.includes(q))
      .map((s) => s.id);
    const orParts = [`title.ilike.%${q}%`];
    if (matchingStoreIds.length > 0) {
      orParts.push(`store_id.in.(${matchingStoreIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data: jobs } = await query;

  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: applications } =
    jobIds.length > 0
      ? await supabase.from("job_applications").select("job_id").in("job_id", jobIds)
      : { data: [] as { job_id: string }[] };
  const applicantCounts = new Map<string, number>();
  (applications ?? []).forEach((a) => {
    applicantCounts.set(a.job_id, (applicantCounts.get(a.job_id) ?? 0) + 1);
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>求人管理（全店舗）</h1>

      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>＋ 求人を掲載</summary>
        <form
          action={createJobByAdmin}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
        >
          <div className="field">
            <span className="muted">店舗 *</span>
            <select name="storeId" required defaultValue="">
              <option value="" disabled>
                選択してください
              </option>
              {allStores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">求人タイトル *</span>
            <input type="text" name="title" required />
          </div>
          <div className="field">
            <span className="muted">雇用形態</span>
            <select name="jobType" defaultValue="">
              <option value="">未設定</option>
              {JOB_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">給与</span>
            <input type="text" name="salary" />
          </div>
          <div className="field">
            <span className="muted">仕事内容</span>
            <textarea name="description" rows={3} />
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            掲載する
          </button>
        </form>
      </details>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="求人タイトル・店舗名で検索"
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
              <th>応募数</th>
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
                <td className="tabular">{applicantCounts.get(j.id) ?? 0}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
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
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 12.5 }}>編集</summary>
                    <form
                      action={updateJobByAdmin}
                      style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, minWidth: 200 }}
                    >
                      <input type="hidden" name="jobId" value={j.id} />
                      <div className="field">
                        <span className="muted">求人タイトル *</span>
                        <input type="text" name="title" defaultValue={j.title} required />
                      </div>
                      <div className="field">
                        <span className="muted">雇用形態</span>
                        <select name="jobType" defaultValue={j.job_type ?? ""}>
                          <option value="">未設定</option>
                          {JOB_TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <span className="muted">給与</span>
                        <input type="text" name="salary" defaultValue={j.salary ?? ""} />
                      </div>
                      <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
                        保存する
                      </button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

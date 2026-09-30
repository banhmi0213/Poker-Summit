import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateJobByAdmin } from "../../actions";
import { JOB_TYPE_OPTIONS } from "@/lib/constants";

// 従来は /admin/jobs の一覧テーブル内(操作列、幅の狭いセル)に<details>で
// インライン展開していたが、店舗管理と同じ理由(2026/09/30)で使いにくいとの
// 指摘を受け、独立した編集ページに分離した。
// (app/admin/stores/[id]/edit と同じパターン)
export default async function AdminJobEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, job_type, salary, description, status, store_id, stores(name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!job) {
    notFound();
  }

  const storeName = (job.stores as unknown as { name: string } | null)?.name ?? "";

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{job.title} を編集</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            <span className="badge outline" style={{ marginRight: 6 }}>
              {storeName || "店舗未設定"}
            </span>
            <span className="badge">{job.status === "open" ? "募集中" : "終了"}</span>
          </div>
        </div>
        <Link href="/admin/jobs" className="btn">
          ← 求人一覧へ戻る
        </Link>
      </div>

      <div className="card">
        <form
          action={updateJobByAdmin}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          <input type="hidden" name="jobId" value={job.id} />

          <div className="field">
            <span className="muted">求人タイトル *</span>
            <input type="text" name="title" defaultValue={job.title} required />
          </div>

          <div className="field">
            <span className="muted">雇用形態</span>
            <select name="jobType" defaultValue={job.job_type ?? ""}>
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
            <input type="text" name="salary" defaultValue={job.salary ?? ""} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="muted">仕事内容</span>
            <textarea name="description" rows={4} defaultValue={job.description ?? ""} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" className="btn primary">
              保存する
            </button>
            <Link href="/admin/jobs" className="btn">
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

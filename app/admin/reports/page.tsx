import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setReportStatus, deleteReport } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  open: "未対応",
  investigating: "調査中",
  resolved: "対応済み",
  dismissed: "却下",
};

const TARGET_TYPE_LABEL: Record<string, string> = {
  post: "掲示板投稿",
  reply: "掲示板返信",
  store: "店舗",
  job: "求人",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP");
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await createClient();
  const status = searchParams.status ?? "open";

  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: reports } = await query;

  const postIds = (reports ?? [])
    .filter((r) => r.target_type === "post")
    .map((r) => r.target_id);
  const replyIds = (reports ?? [])
    .filter((r) => r.target_type === "reply")
    .map((r) => r.target_id);
  const storeIds = (reports ?? [])
    .filter((r) => r.target_type === "store")
    .map((r) => r.target_id);
  const jobIds = (reports ?? [])
    .filter((r) => r.target_type === "job")
    .map((r) => r.target_id);

  const [
    { data: posts },
    { data: replies },
    { data: stores },
    { data: jobs },
  ] = await Promise.all([
    postIds.length
      ? supabase.from("board_posts").select("id, title").in("id", postIds)
      : Promise.resolve({ data: [] as any[] }),
    replyIds.length
      ? supabase.from("board_replies").select("id, body, post_id").in("id", replyIds)
      : Promise.resolve({ data: [] as any[] }),
    storeIds.length
      ? supabase.from("stores").select("id, name").in("id", storeIds)
      : Promise.resolve({ data: [] as any[] }),
    jobIds.length
      ? supabase.from("jobs").select("id, title, store_id").in("id", jobIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const postMap = new Map((posts ?? []).map((p) => [p.id, p]));
  const replyMap = new Map((replies ?? []).map((r) => [r.id, r]));
  const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));
  const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

  function targetInfo(r: { target_type: string; target_id: string }) {
    if (r.target_type === "post") {
      const p = postMap.get(r.target_id);
      return {
        label: p ? p.title : "(削除済みの投稿)",
        href: p ? `/board/${p.id}` : null,
      };
    }
    if (r.target_type === "reply") {
      const rep = replyMap.get(r.target_id);
      return {
        label: rep ? rep.body : "(削除済みの返信)",
        href: rep ? `/board/${rep.post_id}` : null,
      };
    }
    if (r.target_type === "store") {
      const s = storeMap.get(r.target_id);
      return {
        label: s ? s.name : "(削除済みの店舗)",
        href: s ? `/stores/${s.id}` : null,
      };
    }
    if (r.target_type === "job") {
      const j = jobMap.get(r.target_id);
      return {
        label: j ? j.title : "(削除済みの求人)",
        href: j ? `/stores/${j.store_id}` : null,
      };
    }
    return { label: r.target_id, href: null };
  }

  const filters: { key: string; label: string }[] = [
    { key: "open", label: "未対応" },
    { key: "investigating", label: "調査中" },
    { key: "resolved", label: "対応済み" },
    { key: "dismissed", label: "却下" },
    { key: "all", label: "すべて" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>通報管理</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/reports?status=${f.key}`}
            className={`btn ${status === f.key ? "primary" : ""}`}
            style={{ fontSize: 12.5 }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {(!reports || reports.length === 0) && (
        <p className="muted">該当する通報はありません。</p>
      )}

      {reports?.map((r) => {
        const info = targetInfo(r);
        return (
          <div className="card" key={r.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <div>
                <span className="badge">{TARGET_TYPE_LABEL[r.target_type] ?? r.target_type}</span>{" "}
                <span className="muted">{formatDate(r.created_at)}</span>
              </div>
              <span className="badge">{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
            <p style={{ marginTop: 8 }}>
              {info.href ? (
                <Link href={info.href}>{info.label}</Link>
              ) : (
                <span className="muted">{info.label}</span>
              )}
            </p>
            {r.reason && <p className="muted" style={{ marginTop: 4 }}>理由: {r.reason}</p>}

            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {r.status !== "investigating" && (
                <form
                  action={async () => {
                    "use server";
                    await setReportStatus(r.id, "investigating");
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                    調査を開始
                  </button>
                </form>
              )}
              {r.status !== "resolved" && (
                <form
                  action={async () => {
                    "use server";
                    await setReportStatus(r.id, "resolved");
                  }}
                >
                  <button type="submit" className="btn primary" style={{ fontSize: 12.5 }}>
                    対応済みにする
                  </button>
                </form>
              )}
              {r.status !== "dismissed" && (
                <form
                  action={async () => {
                    "use server";
                    await setReportStatus(r.id, "dismissed");
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                    却下
                  </button>
                </form>
              )}
              {r.status !== "open" && (
                <form
                  action={async () => {
                    "use server";
                    await setReportStatus(r.id, "open");
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                    未対応に戻す
                  </button>
                </form>
              )}
              <form
                action={async () => {
                  "use server";
                  await deleteReport(r.id);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  削除
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}

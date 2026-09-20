import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { approveApplication, rejectApplication, revertApplication } from "./actions";
import { CATEGORY_LABEL } from "@/lib/constants";

const STATUS_LABEL: Record<string, string> = {
  pending: "未対応",
  unconfirmed: "確認中",
  approved: "承認済み",
  rejected: "却下",
  listed: "掲載済み",
};

export default async function AdminListingApplicationsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "all";

  let query = supabase
    .from("listing_applications")
    .select("*")
    .order("applied_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%`);
  }

  const { data: applications } = await query;

  const isDone = (status: string) =>
    status === "approved" || status === "rejected" || status === "listed";

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>掲載申込管理</h1>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="会社名・店舗名・担当者で検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 240,
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
          <option value="all">ステータス: すべて</option>
          <option value="unconfirmed">未確認</option>
          <option value="pending">承認待ち</option>
          <option value="approved">承認済み</option>
          <option value="listed">掲載済み</option>
          <option value="rejected">却下</option>
        </select>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      {(!applications || applications.length === 0) && (
        <p className="muted">現在、掲載申込はありません。</p>
      )}

      {applications && applications.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>会社名・屋号</th>
              <th>担当者</th>
              <th>連絡先</th>
              <th>都道府県</th>
              <th>カテゴリ</th>
              <th>申請日</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id}>
                <td>{a.company_name}</td>
                <td>{a.contact_name}</td>
                <td>
                  <div>{a.email}</div>
                  <div className="muted">{a.tel}</div>
                </td>
                <td>{a.pref}</td>
                <td>{CATEGORY_LABEL[a.category] ?? a.category}</td>
                <td>{a.applied_at ? String(a.applied_at).slice(0, 10) : ""}</td>
                <td>
                  <span className="badge">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link href={`/admin/listing-applications/${a.id}`} className="btn" style={{ fontSize: 12 }}>
                      詳細
                    </Link>
                    {a.status === "rejected" && (
                      <form
                        action={async () => {
                          "use server";
                          await revertApplication(a.id);
                        }}
                      >
                        <button type="submit" className="btn">
                          承認待ちに戻す
                        </button>
                      </form>
                    )}
                    {isDone(a.status) ? (
                      <span className="muted">対応済み</span>
                    ) : (
                      <>
                        <form
                          action={async () => {
                            "use server";
                            await approveApplication(a.id);
                          }}
                        >
                          <button type="submit" className="btn primary">
                            承認して店舗作成
                          </button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await rejectApplication(a.id);
                          }}
                        >
                          <button type="submit" className="btn">
                            却下
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {applications?.some((a) => a.message) && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>申込メッセージ</h2>
          {applications
            .filter((a) => a.message)
            .map((a) => (
              <div className="card" key={`msg-${a.id}`}>
                <div className="muted">{a.company_name}</div>
                <p style={{ marginTop: 6, fontSize: 13.5 }}>{a.message}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

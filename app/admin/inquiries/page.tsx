import { createClient } from "@/lib/supabase/server";
import { setInquiryStatus } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  unread: "未読",
  in_progress: "対応中",
  done: "対応済み",
};

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminInquiriesPage() {
  const supabase = await createClient();
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>お問い合わせ管理</h1>

      {(!inquiries || inquiries.length === 0) && (
        <p className="muted">現在、お問い合わせはありません。</p>
      )}

      {inquiries?.map((i) => (
        <div className="card" key={i.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div>
              <h3>{i.subject || "（件名なし）"}</h3>
              <div className="muted">
                {i.name} ・ {i.email} {i.tel ? `・ ${i.tel}` : ""}
              </div>
              <div className="muted">{formatDate(i.created_at)}</div>
            </div>
            <span className="badge">{STATUS_LABEL[i.status] ?? i.status}</span>
          </div>
          <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{i.message}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {i.status !== "in_progress" && (
              <form
                action={async () => {
                  "use server";
                  await setInquiryStatus(i.id, "in_progress");
                }}
              >
                <button type="submit" className="btn">
                  対応中にする
                </button>
              </form>
            )}
            {i.status !== "done" && (
              <form
                action={async () => {
                  "use server";
                  await setInquiryStatus(i.id, "done");
                }}
              >
                <button type="submit" className="btn primary">
                  対応済みにする
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

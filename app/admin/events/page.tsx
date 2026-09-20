import { createClient } from "@/lib/supabase/server";
import { setEventStatus, deleteEvent } from "./actions";

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP");
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q ?? "";
  const status = searchParams.status ?? "all";

  let query = supabase
    .from("events")
    .select("id, title, location, start_at, end_at, status, store_id, stores(name)")
    .order("start_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: events } = await query;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>イベント管理（全店舗）</h1>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="イベント名で検索"
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
          <option value="published">公開中</option>
          <option value="closed">非公開</option>
        </select>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      {(!events || events.length === 0) && <p className="muted">該当するイベントはありません。</p>}

      {events && events.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>店舗</th>
              <th>イベント名</th>
              <th>開催場所</th>
              <th>開始日時</th>
              <th>終了日時</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev: any) => (
              <tr key={ev.id}>
                <td>{ev.stores?.name ?? ""}</td>
                <td>{ev.title}</td>
                <td>{ev.location ?? ""}</td>
                <td>{formatDateTime(ev.start_at)}</td>
                <td>{formatDateTime(ev.end_at)}</td>
                <td>
                  <span className="badge">
                    {ev.status === "published" ? "公開中" : "非公開"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <form
                      action={async () => {
                        "use server";
                        await setEventStatus(
                          ev.id,
                          ev.status === "published" ? "closed" : "published"
                        );
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        {ev.status === "published" ? "非公開にする" : "公開する"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deleteEvent(ev.id);
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

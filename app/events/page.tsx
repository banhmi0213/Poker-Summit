import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, location, description, start_at, end_at, store_id, stores(name)")
    .eq("status", "published")
    .order("start_at", { ascending: true });

  return (
    <div>
      <header className="header">
        <Link href="/" className="brand">
          Poker Summit
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/jobs" className="btn">
            求人
          </Link>
          <Link href="/coupons" className="btn">
            クーポン
          </Link>
          <Link href="/board" className="btn">
            掲示板
          </Link>
        </div>
      </header>
      <div className="container">
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>イベント一覧</h1>

        {(!events || events.length === 0) && (
          <p className="muted">現在開催予定のイベントはありません。</p>
        )}

        {events?.map((e: any) => (
          <Link href={`/events/${e.id}`} key={e.id} style={{ display: "block" }}>
            <div className="card">
              <h3>{e.title}</h3>
              {e.stores?.name && <div className="muted">{e.stores.name}</div>}
              {e.start_at && (
                <div className="muted" style={{ marginTop: 4 }}>
                  {formatDate(e.start_at)}
                  {e.end_at ? ` 〜 ${formatDate(e.end_at)}` : ""}
                </div>
              )}
              {e.location && <div className="muted">{e.location}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

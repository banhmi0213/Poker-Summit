import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinEvent, leaveEvent } from "@/app/member-actions";

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

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, location, description, start_at, end_at, status, store_id, stores(id, name)")
    .eq("id", params.id)
    .eq("status", "published")
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const e = event as any;
  const path = `/events/${e.id}`;

  let joined = false;
  if (user) {
    const { data: participant } = await supabase
      .from("event_participants")
      .select("event_id")
      .eq("user_id", user.id)
      .eq("event_id", e.id)
      .maybeSingle();
    joined = !!participant;
  }

  return (
    <div>
      <header className="header">
        <Link href="/" className="brand">
          Poker Summit
        </Link>
        <Link href="/events" className="btn">
          イベント一覧へ
        </Link>
      </header>
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card">
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>{e.title}</h1>
          {e.stores?.name && (
            <p className="muted">
              主催店舗：
              <Link href={`/stores/${e.store_id}`}>{e.stores.name}</Link>
            </p>
          )}
          {e.start_at && (
            <p className="muted">
              開催日時：{formatDate(e.start_at)}
              {e.end_at ? ` 〜 ${formatDate(e.end_at)}` : ""}
            </p>
          )}
          {e.location && <p className="muted">開催場所：{e.location}</p>}
          {e.description && (
            <p style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
              {e.description}
            </p>
          )}
          <form
            action={async () => {
              "use server";
              if (joined) {
                await leaveEvent(e.id, path);
              } else {
                await joinEvent(e.id, path);
              }
            }}
            style={{ marginTop: 16 }}
          >
            <button type="submit" className={`btn ${joined ? "" : "primary"}`}>
              {joined ? "参加を取り消す" : "参加予定にする"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

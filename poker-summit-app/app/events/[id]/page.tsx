import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinEvent, leaveEvent } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

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
    .select(
      "id, title, location, description, start_at, end_at, status, category, store_id, stores(id, name)"
    )
    .eq("id", params.id)
    .eq("status", "published")
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const e = event as any;
  const path = `/events/${e.id}`;
  const isPast = e.start_at ? e.start_at < new Date().toISOString() : false;

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
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ maxWidth: 640 }}>
        <Link href="/events" className="breadcrumb">
          ← イベント一覧に戻る
        </Link>
        <div className="meta" style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {e.start_at && <span className="badge accent">{formatDate(e.start_at)}</span>}
          {e.category && <span className="badge outline">{e.category}</span>}
          {isPast && <span className="badge outline">終了</span>}
        </div>
        <h1 style={{ fontSize: 20 }}>{e.title}</h1>
        {e.stores?.name && (
          <p className="muted" style={{ marginTop: 6 }}>
            主催店舗：<Link href={`/stores/${e.store_id}`}>{e.stores.name}</Link>
          </p>
        )}
        {e.end_at && (
          <p className="muted" style={{ marginTop: 4 }}>
            〜{formatDate(e.end_at)}
          </p>
        )}
        {e.location && <p className="muted" style={{ marginTop: 4 }}>開催場所：{e.location}</p>}
        {e.description && (
          <p style={{ marginTop: 16, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{e.description}</p>
        )}

        <div className="flex" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {isPast ? (
            joined ? (
              <span className="badge good">✓ 参加予定に登録していました</span>
            ) : (
              <span className="badge outline">このイベントは終了しました</span>
            )
          ) : (
            <form
              action={async () => {
                "use server";
                if (joined) {
                  await leaveEvent(e.id, path);
                } else {
                  await joinEvent(e.id, path);
                }
              }}
            >
              <button type="submit" className={`btn ${joined ? "primary" : ""}`}>
                {joined ? "✓ 参加予定に登録済み" : "📅 参加予定に追加"}
              </button>
            </form>
          )}
          {e.store_id && (
            <Link href={`/stores/${e.store_id}`} className="btn">
              主催店舗のページを見る
            </Link>
          )}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

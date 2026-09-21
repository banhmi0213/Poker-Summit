import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { PREF_OPTIONS, EVENT_CATEGORIES } from "@/lib/constants";

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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { pref?: string; category?: string };
}) {
  const pref = searchParams.pref ?? "";
  const category = searchParams.category ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("events")
    .select("id, title, location, description, start_at, end_at, category, store_id, stores(name, pref)")
    .eq("status", "published");

  if (category) query = query.eq("category", category);

  const { data: rawEvents } = await query;
  let events = rawEvents ?? [];
  if (pref) events = events.filter((e: any) => e.stores?.pref === pref);

  const now = new Date().toISOString();
  const upcoming = events
    .filter((e: any) => !e.start_at || e.start_at >= now)
    .sort((a: any, b: any) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));
  const past = events
    .filter((e: any) => e.start_at && e.start_at < now)
    .sort((a: any, b: any) => (b.start_at ?? "").localeCompare(a.start_at ?? ""));
  const list = [...upcoming, ...past];

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>トーナメント・イベント</h1>

        <form
          method="get"
          className="card"
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}
        >
          <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
            <span className="muted">都道府県</span>
            <select name="pref" defaultValue={pref}>
              <option value="">すべて</option>
              {PREF_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
            <span className="muted">カテゴリ</span>
            <select name="category" defaultValue={category}>
              <option value="">すべて</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn primary">
            🔍 絞り込む
          </button>
        </form>

        {list.length === 0 && <div className="empty">条件に合うイベントが見つかりませんでした。</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {list.map((e: any) => {
            const isPast = e.start_at && e.start_at < now;
            return (
              <Link
                href={`/events/${e.id}`}
                key={e.id}
                style={{ display: "block", opacity: isPast ? 0.62 : 1 }}
              >
                <div className="card">
                  <div className="meta" style={{ marginBottom: 6 }}>
                    {e.start_at && <span className="badge accent">{formatDate(e.start_at)}</span>}
                    {e.category && <span className="badge outline">{e.category}</span>}
                    {isPast && <span className="badge outline">終了</span>}
                  </div>
                  <h3>{e.title}</h3>
                  {e.stores?.name && <div className="muted">{e.stores.name}</div>}
                  {e.location && <div className="muted">{e.location}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

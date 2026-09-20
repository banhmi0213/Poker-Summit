import { createClient } from "@/lib/supabase/server";
import { setEventStatus, deleteEvent, createEventByAdmin, updateEventByAdmin } from "./actions";
import { EVENT_CATEGORIES, PREF_OPTIONS } from "@/lib/constants";

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP");
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q ?? "";

  const { data: allStores } = await supabase
    .from("stores")
    .select("id, name")
    .order("name", { ascending: true });

  let query = supabase
    .from("events")
    .select("id, title, location, start_at, end_at, status, category, pref, store_id, stores(name)");

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

  const { data: rawEvents } = await query;
  const now = new Date().toISOString();
  const upcoming = (rawEvents ?? [])
    .filter((e: any) => !e.start_at || e.start_at >= now)
    .sort((a: any, b: any) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));
  const past = (rawEvents ?? [])
    .filter((e: any) => e.start_at && e.start_at < now)
    .sort((a: any, b: any) => (b.start_at ?? "").localeCompare(a.start_at ?? ""));
  const events = [...upcoming, ...past];

  const eventIds = events.map((e: any) => e.id);
  const { data: participants } =
    eventIds.length > 0
      ? await supabase.from("event_participants").select("event_id").in("event_id", eventIds)
      : { data: [] as { event_id: string }[] };
  const participantCounts = new Map<string, number>();
  (participants ?? []).forEach((p) => {
    participantCounts.set(p.event_id, (participantCounts.get(p.event_id) ?? 0) + 1);
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>イベント管理（全店舗）</h1>

      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>＋ イベントを追加</summary>
        <form
          action={createEventByAdmin}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
        >
          <div className="field">
            <span className="muted">主催店舗（未選択の場合 Poker Summit事務局主催）</span>
            <select name="storeId" defaultValue="">
              <option value="">Poker Summit事務局</option>
              {allStores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">イベント名 *</span>
            <input type="text" name="title" required />
          </div>
          <div className="field">
            <span className="muted">カテゴリ</span>
            <select name="category" defaultValue="">
              <option value="">未設定</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">都道府県</span>
            <select name="pref" defaultValue="">
              <option value="">未設定</option>
              {PREF_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">開催場所</span>
            <input type="text" name="location" />
          </div>
          <div className="field">
            <span className="muted">開始日時</span>
            <input type="datetime-local" name="startAt" />
          </div>
          <div className="field">
            <span className="muted">終了日時</span>
            <input type="datetime-local" name="endAt" />
          </div>
          <div className="field">
            <span className="muted">詳細</span>
            <textarea name="description" rows={3} />
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            追加する
          </button>
        </form>
      </details>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="タイトル・主催者で検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 220,
          }}
        />
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      {events.length === 0 && <p className="muted">該当するイベントはありません。</p>}

      {events.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>タイトル</th>
              <th>主催</th>
              <th>都道府県</th>
              <th>カテゴリ</th>
              <th>開始日時</th>
              <th>参加者数</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev: any) => {
              const isPast = ev.start_at && ev.start_at < now;
              return (
                <tr key={ev.id}>
                  <td>
                    {ev.title}
                    {isPast && <span className="badge outline" style={{ marginLeft: 6 }}>終了</span>}
                  </td>
                  <td>{ev.stores?.name ?? "Poker Summit事務局"}</td>
                  <td>{ev.pref ?? ""}</td>
                  <td>{ev.category ?? ""}</td>
                  <td>{formatDateTime(ev.start_at)}</td>
                  <td className="tabular">{participantCounts.get(ev.id) ?? 0}</td>
                  <td>
                    <span className="badge">
                      {ev.status === "published" ? "公開中" : "非公開"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
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
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 12.5 }}>編集</summary>
                      <form
                        action={updateEventByAdmin}
                        style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, minWidth: 220 }}
                      >
                        <input type="hidden" name="eventId" value={ev.id} />
                        <div className="field">
                          <span className="muted">イベント名 *</span>
                          <input type="text" name="title" defaultValue={ev.title} required />
                        </div>
                        <div className="field">
                          <span className="muted">カテゴリ</span>
                          <select name="category" defaultValue={ev.category ?? ""}>
                            <option value="">未設定</option>
                            {EVENT_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <span className="muted">都道府県</span>
                          <select name="pref" defaultValue={ev.pref ?? ""}>
                            <option value="">未設定</option>
                            {PREF_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <span className="muted">開催場所</span>
                          <input type="text" name="location" defaultValue={ev.location ?? ""} />
                        </div>
                        <div className="field">
                          <span className="muted">開始日時</span>
                          <input
                            type="datetime-local"
                            name="startAt"
                            defaultValue={toDatetimeLocal(ev.start_at)}
                          />
                        </div>
                        <div className="field">
                          <span className="muted">終了日時</span>
                          <input
                            type="datetime-local"
                            name="endAt"
                            defaultValue={toDatetimeLocal(ev.end_at)}
                          />
                        </div>
                        <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
                          保存する
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

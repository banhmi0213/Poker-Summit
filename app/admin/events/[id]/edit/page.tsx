import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEventByAdmin } from "../../actions";
import { EVENT_CATEGORIES, PREF_OPTIONS } from "@/lib/constants";

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 従来は /admin/events の一覧テーブル内(操作列、幅の狭いセル)に<details>で
// インライン展開していたが、店舗管理・求人管理と同じ理由(2026/09/30)で
// 使いにくいとの指摘を受け、独立した編集ページに分離した。
// (app/admin/stores/[id]/edit, app/admin/jobs/[id]/edit と同じパターン)
export default async function AdminEventEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, location, description, start_at, end_at, status, category, pref, store_id, stores(name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const storeName = (event.stores as unknown as { name: string } | null)?.name ?? "Poker Summit事務局";

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{event.title} を編集</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            <span className="badge outline" style={{ marginRight: 6 }}>
              {storeName}
            </span>
            <span className="badge">{event.status === "published" ? "公開中" : "非公開"}</span>
          </div>
        </div>
        <Link href="/admin/events" className="btn">
          ← イベント一覧へ戻る
        </Link>
      </div>

      <div className="card">
        <form
          action={updateEventByAdmin}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          <input type="hidden" name="eventId" value={event.id} />

          <div className="field">
            <span className="muted">イベント名 *</span>
            <input type="text" name="title" defaultValue={event.title} required />
          </div>

          <div className="field">
            <span className="muted">カテゴリ</span>
            <select name="category" defaultValue={event.category ?? ""}>
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
            <select name="pref" defaultValue={event.pref ?? ""}>
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
            <input type="text" name="location" defaultValue={event.location ?? ""} />
          </div>

          <div className="field">
            <span className="muted">開始日時</span>
            <input type="datetime-local" name="startAt" defaultValue={toDatetimeLocal(event.start_at)} />
          </div>

          <div className="field">
            <span className="muted">終了日時</span>
            <input type="datetime-local" name="endAt" defaultValue={toDatetimeLocal(event.end_at)} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="muted">詳細</span>
            <textarea name="description" rows={4} defaultValue={event.description ?? ""} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" className="btn primary">
              保存する
            </button>
            <Link href="/admin/events" className="btn">
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

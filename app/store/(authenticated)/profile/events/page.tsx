import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createEvent, toggleEventStatus, updateEvent, deleteEvent } from "../events-actions";
import { EVENT_CATEGORIES } from "@/lib/constants";

// /store/profile 1ページの中の1セクションだったイベント管理を、独立した
// ページへ分離(2026/09/30)。バナー画像はファイルアップロード対応
// (2026/09/30)。
export default async function StoreEventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/events");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    return (
      <div className="container">
        <p className="err">このアカウントに紐づく店舗が見つかりません。運営に店舗オーナーとしての登録を依頼してください。</p>
      </div>
    );
  }

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("store_id", store.id)
    .order("start_at", { ascending: true });

  const eventIds = (events ?? []).map((e) => e.id);

  const { data: partRows } = eventIds.length
    ? await supabase.from("event_participants").select("event_id").in("event_id", eventIds)
    : { data: [] as { event_id: string }[] };

  const eventParticipantCounts: Record<string, number> = {};
  partRows?.forEach((r) => {
    eventParticipantCounts[r.event_id] = (eventParticipantCounts[r.event_id] ?? 0) + 1;
  });

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>トーナメント・イベント管理</h1>

      <div className="card">
        <form action={createEvent} encType="multipart/form-data">
          <input type="hidden" name="storeId" value={store.id} />
          <div className="field">
            <span className="muted">トーナメント・イベント名 *</span>
            <input type="text" name="title" required />
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
            <span className="muted">イベント詳細</span>
            <textarea name="description" rows={3} />
          </div>
          <div className="field">
            <span className="muted">カテゴリ</span>
            <select name="category" defaultValue="">
              <option value="">選択してください</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">バナー画像（任意）</span>
            <input type="file" name="bannerImage" accept="image/*" capture="environment" />
          </div>
          <button type="submit" className="btn primary">
            イベントを掲載する
          </button>
        </form>
      </div>

      {events?.map((ev) => {
        const isPast = ev.start_at ? ev.start_at < new Date().toISOString() : false;
        return (
          <div className="card" key={ev.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3>{ev.title}</h3>
              <div style={{ display: "flex", gap: 6 }}>
                {ev.category && <span className="badge outline">{ev.category}</span>}
                {isPast && <span className="badge outline">終了</span>}
                <span className="badge">{ev.status === "published" ? "公開中" : "非公開"}</span>
              </div>
            </div>
            {ev.banner_image_url && (
              <img
                src={ev.banner_image_url}
                alt=""
                style={{ width: "100%", maxWidth: 320, borderRadius: 8, marginTop: 8, objectFit: "cover" }}
              />
            )}
            {ev.location && <p className="muted">{ev.location}</p>}
            <p className="muted small" style={{ marginTop: 4 }}>
              参加者数: {eventParticipantCounts[ev.id] ?? 0}人
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <form
                action={async () => {
                  "use server";
                  await toggleEventStatus(ev.id, store.id, ev.status === "published" ? "closed" : "published");
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  {ev.status === "published" ? "非公開にする" : "公開する"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deleteEvent(ev.id, store.id);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  削除
                </button>
              </form>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary className="muted small" style={{ cursor: "pointer" }}>
                編集
              </summary>
              <form action={updateEvent} encType="multipart/form-data" style={{ marginTop: 10 }}>
                <input type="hidden" name="storeId" value={store.id} />
                <input type="hidden" name="eventId" value={ev.id} />
                <div className="field">
                  <span className="muted">トーナメント・イベント名 *</span>
                  <input type="text" name="title" required defaultValue={ev.title} />
                </div>
                <div className="field">
                  <span className="muted">開催場所</span>
                  <input type="text" name="location" defaultValue={ev.location ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">開始日時</span>
                  <input type="datetime-local" name="startAt" defaultValue={ev.start_at ? ev.start_at.slice(0, 16) : ""} />
                </div>
                <div className="field">
                  <span className="muted">終了日時</span>
                  <input type="datetime-local" name="endAt" defaultValue={ev.end_at ? ev.end_at.slice(0, 16) : ""} />
                </div>
                <div className="field">
                  <span className="muted">イベント詳細</span>
                  <textarea name="description" rows={3} defaultValue={ev.description ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">カテゴリ</span>
                  <select name="category" defaultValue={ev.category ?? ""}>
                    <option value="">選択してください</option>
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="muted">バナー画像を差し替える（任意）</span>
                  <input type="file" name="bannerImage" accept="image/*" capture="environment" />
                </div>
                {ev.banner_image_url && (
                  <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <input type="checkbox" name="removeBanner" />
                    現在のバナー画像を削除する
                  </label>
                )}
                <button type="submit" className="btn primary" style={{ fontSize: 12.5, marginTop: 10 }}>
                  更新する
                </button>
              </form>
            </details>
          </div>
        );
      })}
    </div>
  );
}

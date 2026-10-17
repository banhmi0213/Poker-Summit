import { ReadableName } from "@/app/readable-name";
import Link from "next/link";
import { toEventLocalInput } from "@/lib/event-dates";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createEvent, toggleEventStatus, updateEvent, deleteEvent } from "../events-actions";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { StoreContentRuleNotice } from "../content-rule-notice";
import { ConfirmButton } from "../confirm-button";
import s from "../manage.module.css";

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

  const nowIso = new Date().toISOString();
  // これから開催するもの(近い順)を上に、開催済みは新しい順で下にまとめる
  const isPastEvent = (e: { start_at: string | null }) => (e.start_at ? e.start_at < nowIso : false);
  const eventList = [
    ...(events ?? []).filter((e) => !isPastEvent(e)),
    ...(events ?? []).filter(isPastEvent).reverse(),
  ];
  const fmt = (v: string | null) =>
    v ? new Date(v).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }) : null;
  const dt = { width: "100%", maxWidth: 300, alignSelf: "flex-start", boxSizing: "border-box" } as const;
  const eventFields = (ev?: (typeof eventList)[number]) => (
    <>
      <div className="field">
        <span>トーナメント・イベント名 *</span>
        <input type="text" name="title" required defaultValue={ev?.title ?? ""} />
      </div>
      <div className="field">
        <span>開催場所</span>
        <input type="text" name="location" defaultValue={ev?.location ?? ""} />
      </div>
      <div className="field">
        <span>開始日時（日本時間）</span>
        <input type="datetime-local" style={dt} name="startAt" defaultValue={ev ? toEventLocalInput(ev.start_at) : undefined} />
      </div>
      <div className="field">
        <span>終了日時（日本時間）</span>
        <input type="datetime-local" style={dt} name="endAt" defaultValue={ev ? toEventLocalInput(ev.end_at) : undefined} />
      </div>
      <div className="field">
        <span>イベント詳細</span>
        <textarea name="description" rows={4} defaultValue={ev?.description ?? ""} />
      </div>
      <div className="field">
        <span>カテゴリ</span>
        <select name="category" defaultValue={ev?.category ?? ""}>
          <option value="">選択してください</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span>{ev ? "バナー画像を差し替える（任意）" : "バナー画像（任意）"}</span>
        <input type="file" name="bannerImage" accept="image/*" capture="environment" />
      </div>
      {ev?.banner_image_url && (
        <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 8, margin: "-4px 0 14px", fontSize: 14 }}>
          <input type="checkbox" name="removeBanner" />
          現在のバナー画像を削除する
        </label>
      )}
    </>
  );

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>トーナメント・イベント管理</h1>
      <StoreContentRuleNotice />

      <details className={`card ${s.add}`} open={eventList.length === 0}>
        <summary>
          <span className={s.plus} aria-hidden>＋</span>新しいイベントを掲載する
        </summary>
        <div className={s.addBody}>
          <form action={createEvent} encType="multipart/form-data">
            <input type="hidden" name="storeId" value={store.id} />
            {eventFields()}
            <button type="submit" className="btn primary">
              イベントを掲載する
            </button>
          </form>
        </div>
      </details>

      {eventList.length > 0 && (
        <div className={s.listHead}>
          <h2>掲載したイベント</h2>
          <span>{eventList.length}件</span>
        </div>
      )}

      {eventList.map((ev) => {
        const isPast = isPastEvent(ev);
        const published = ev.status === "published";
        const start = fmt(ev.start_at);
        const sameDay = !!ev.start_at && !!ev.end_at && new Date(ev.start_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) === new Date(ev.end_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
        const end = sameDay ? new Date(ev.end_at as string).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }) : fmt(ev.end_at);
        return (
          <div className={`card ${s.item} ${published && !isPast ? "" : s.closed}`} key={ev.id}>
            <h3 className={s.itemTitle}><ReadableName name={ev.title} /></h3>
            <div className={s.badges}>
              <span className={`badge ${published ? s.badgeOn : s.badgeOff}`}>{published ? "公開中" : "非公開"}</span>
              {isPast && <span className={`badge ${s.badgeOff}`}>開催済み</span>}
              {ev.category && <span className="badge outline">{ev.category}</span>}
            </div>
            {ev.banner_image_url && <img className={s.thumb} src={ev.banner_image_url} alt="" loading="lazy" />}
            <div className={s.facts}>
              {start && <span>🗓 {start}{end ? ` 〜 ${end}` : ""}</span>}
              {ev.location && <span>📍 {ev.location}</span>}
              <span className={s.sub}>参加予定 {eventParticipantCounts[ev.id] ?? 0}人</span>
            </div>
            <div className={s.actions}>
              <form
                action={async () => {
                  "use server";
                  await toggleEventStatus(ev.id, store.id, published ? "closed" : "published");
                }}
              >
                <button type="submit" className="btn">
                  {published ? "非公開にする" : "公開する"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deleteEvent(ev.id, store.id);
                }}
              >
                <ConfirmButton className={`btn ${s.danger}`} message={`「${ev.title}」を削除しますか？参加予定の記録も見られなくなります。この操作は取り消せません。`}>
                  削除する
                </ConfirmButton>
              </form>
            </div>
            <details className={s.more}>
              <summary>内容を編集する</summary>
              <div className={s.moreBody}>
                <form action={updateEvent} encType="multipart/form-data" className={s.editForm}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="eventId" value={ev.id} />
                  {eventFields(ev)}
                  <button type="submit" className="btn primary">
                    更新する
                  </button>
                </form>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}

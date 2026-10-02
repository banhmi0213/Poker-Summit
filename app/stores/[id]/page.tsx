import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/constants";
import {
  toggleFavoriteStore,
  toggleFavoriteJob,
  applyToJob,
  joinEvent,
  useCoupon,
} from "@/app/member-actions";
import { reportStore, reportJob } from "@/app/report-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { classifyDevice } from "@/lib/device";
import { StorePhotoGallery } from "./store-photo-gallery";
import { StoreDetailTabs } from "./store-detail-tabs";

export default async function StoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  // Independent of each other, so fetched together.
  const [
    {
      data: { user },
    },
    { data: store },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("stores")
      .select("*")
      .eq("id", params.id)
      .in("status", ["approved", "listed"])
      .maybeSingle(),
  ]);

  if (!store) {
    notFound();
  }

  const path = `/stores/${store.id}`;
  const hdrs = await headers();
  const referrer = hdrs.get("referer") ?? null;
  const device = classifyDevice(hdrs.get("user-agent"));

  supabase
    .from("page_views")
    .insert({ path, store_id: store.id, referrer, device })
    .then(() => {});

  // These only depend on store.id, not on each other.
  const [{ data: events }, { data: jobs }, { data: coupons }, { data: notices }, { data: photos }, { data: menuItems }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, location, start_at")
        .eq("store_id", store.id)
        .eq("status", "published")
        .order("start_at", { ascending: true }),
      supabase
        .from("jobs")
        .select("id, title, job_type, salary, description, posted_at")
        .eq("store_id", store.id)
        .eq("status", "open")
        .order("posted_at", { ascending: false }),
      supabase
        .from("coupons")
        .select("id, title, discount, description, code, valid_until, usage_limit, used_count")
        .eq("store_id", store.id)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("store_notices")
        .select("id, title, body, created_at")
        .eq("store_id", store.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase
        .from("store_photos")
        .select("id, url")
        .eq("store_id", store.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("store_menu_items")
        .select("id, name, price, description")
        .eq("store_id", store.id)
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  let isFavoriteStore = false;
  let favoriteJobIds = new Set<string>();
  let appliedJobIds = new Set<string>();
  let joinedEventIds = new Set<string>();
  let usedCouponIds = new Set<string>();

  if (user) {
    const [
      { data: favStore },
      { data: favJobs },
      { data: apps },
      { data: parts },
      { data: uses },
    ] = await Promise.all([
      supabase
        .from("favorite_stores")
        .select("store_id")
        .eq("user_id", user.id)
        .eq("store_id", store.id)
        .maybeSingle(),
      supabase.from("favorite_jobs").select("job_id").eq("user_id", user.id),
      supabase.from("job_applications").select("job_id").eq("user_id", user.id),
      supabase
        .from("event_participants")
        .select("event_id")
        .eq("user_id", user.id),
      supabase.from("coupon_uses").select("coupon_id").eq("user_id", user.id),
    ]);

    isFavoriteStore = !!favStore;
    favoriteJobIds = new Set((favJobs ?? []).map((f) => f.job_id));
    appliedJobIds = new Set((apps ?? []).map((a) => a.job_id));
    joinedEventIds = new Set((parts ?? []).map((p) => p.event_id));
    usedCouponIds = new Set((uses ?? []).map((u) => u.coupon_id));
  }

  // 住所の承認時に運営側で自動取得済みの緯度経度(store.lat/lng)があれば、
  // それを使って地図を組み立てる方が、住所テキストを都度あいまい検索する
  // より実際の店舗位置に近い(2026/10、店舗管理画面で記載した情報が公開
  // ページにしっかり反映されるように、とのご指摘を受けて対応)。緯度経度が
  // まだ無い店舗(新規登録直後など)は、従来どおり住所テキストで検索する。
  const hasCoords = store.lat != null && store.lng != null;
  const mapQuery = hasCoords
    ? `${store.lat},${store.lng}`
    : [store.address, store.pref, store.city, store.name].filter(Boolean).join(" ");
  const mapUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapQuery);
  const mapEmbedQuery = hasCoords ? `${store.lat},${store.lng}` : store.address;
  const phone = store.tel ? String(store.tel).replace(/[^+0-9]/g, "") : "";

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <main className="container sd-page">
        <Link href="/stores" className="breadcrumb">← 店舗を探すに戻る</Link>
        <div className="sd-title-row">
          <div className="sd-title"><h1>{store.name}</h1>
            <span className="badge outline">📍 {[store.pref, store.city].filter(Boolean).join(" ")}</span>
            {store.category && <span className="badge">{CATEGORY_LABEL[store.category] ?? store.category}</span>}
          </div>
          <form action={async () => { "use server"; await toggleFavoriteStore(store.id, path); }}>
            <button type="submit" className={`btn sd-favorite ${isFavoriteStore ? "is-active" : ""}`}>
              {isFavoriteStore ? "♥ お気に入り済み" : "♡ お気に入りに追加"}
            </button>
          </form>
        </div>
        <div className="sd-hero-grid">
          <StorePhotoGallery key={store.id} photos={photos ?? []} name={store.name} />
          <aside className="sd-info">
            <dl className="sd-info-list">
              <div><dt>営業時間</dt><dd>{store.hours || "店舗にお問い合わせください"}</dd></div>
              <div><dt>住所</dt><dd>{store.address || [store.pref, store.city].filter(Boolean).join(" ") || "未登録"}</dd></div>
              <div><dt>電話番号</dt><dd>{store.tel ? <a href={`tel:${phone}`}>{store.tel}</a> : "未登録"}</dd></div>
            </dl>
            <div className="sd-contact-actions">
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn primary">地図・経路を見る</a>
              {phone ? <a href={`tel:${phone}`} className="btn">電話をかける</a> : <Link href="/contact" className="btn">お問い合わせ</Link>}
            </div>
            {mapEmbedQuery && <iframe className="sd-map" title={store.name + "の所在地"}
              src={"https://maps.google.com/maps?q=" + encodeURIComponent(mapEmbedQuery) + "&output=embed"}
              loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </aside>
        </div>
        <StoreDetailTabs key={store.id} panels={[
          { id: "menu", label: "料金・メニュー", content: (
            <>{store.description && <section className="sd-introduction"><h2>店舗紹介</h2><p>{store.description}</p></section>}
<section id="store-menu" className="sd-section">
              <h2>料金・メニュー</h2>
              {menuItems && menuItems.length > 0 && <div className="sd-menu-grid">
                {menuItems.map((item) => <article className="card sd-menu-card" key={item.id}>
                  <h3>{item.name}</h3>
                  {item.price && <p className="sd-menu-price">{item.price}</p>}
                  {item.description && <p className="muted">{item.description}</p>}
                </article>)}
              </div>}
              {(!menuItems || menuItems.length === 0) && <><p className="sd-empty">料金・メニューは店舗にお問い合わせください。</p></>}
            </section>
            </>
          ) },
          { id: "events", label: "イベント", content: (
            <>
<section id="store-events" className="sd-section">
        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
          イベント ({events?.length ?? 0})
        </h2>
        {(!events || events.length === 0) && (
          <p className="muted">開催予定のイベントはありません。</p>
        )}
        {events?.map((ev) => (
          <div className="card sd-event-card" key={ev.id}>
            {ev.start_at && <div className="sd-event-date"><strong>{new Date(ev.start_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" })}</strong><span>{new Date(ev.start_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })} 開始</span></div>}
            <Link href={`/events/${ev.id}`}>
              <h3>{ev.title}</h3>
              {ev.location && <p className="muted">{ev.location}</p>}
            </Link>
            <form
              action={async () => {
                "use server";
                await joinEvent(ev.id, path);
              }}
              style={{ marginTop: 8 }}
            >
              <button
                type="submit"
                className={`btn ${joinedEventIds.has(ev.id) ? "primary" : ""}`}
                style={{ fontSize: 12.5 }}
              >
                {joinedEventIds.has(ev.id) ? "参加予定" : "参加予定にする"}
              </button>
            </form>
          </div>
        ))}

            </section>
            </>
          ) },
          { id: "coupons", label: "クーポン", content: (
            <>
<section id="store-coupons" className="sd-section">
        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
          クーポン ({coupons?.length ?? 0})
        </h2>
        {(!coupons || coupons.length === 0) && (
          <p className="muted">現在利用可能なクーポンはありません。</p>
        )}
        {coupons?.map((c) => {
          const limitReached =
            c.usage_limit != null && (c.used_count ?? 0) >= c.usage_limit;
          const alreadyUsed = usedCouponIds.has(c.id);
          return (
            <div className="card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h3>{c.title}</h3>
                {c.discount && <span className="badge">{c.discount}</span>}
              </div>
              {c.description && <p style={{ marginTop: 6, fontSize: 13.5 }}>{c.description}</p>}
              <div className="muted" style={{ marginTop: 6 }}>
                {c.code && <>クーポンコード: {c.code} </>}
                {c.valid_until && <>(有効期限: {c.valid_until})</>}
              </div>
              <form
                action={async () => {
                  "use server";
                  await useCoupon(c.id, path);
                }}
                style={{ marginTop: 8 }}
              >
                <button
                  type="submit"
                  className={`btn ${alreadyUsed ? "" : "primary"}`}
                  disabled={alreadyUsed || (limitReached && !alreadyUsed)}
                >
                  {alreadyUsed
                    ? "✓ 使用済みです"
                    : limitReached
                    ? "利用上限に達しました"
                    : "クーポンを使う"}
                </button>
              </form>
            </div>
          );
        })}


            </section>
            </>
          ) },
          { id: "notices", label: "お知らせ", content: (
            <>
<section id="store-notices" className="sd-section">
        {notices && notices.length > 0 && (
          <>
            <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
              お知らせ ({notices.length})
            </h2>
            {notices.map((n) => (
              <div className="card" key={n.id}>
                <h3>{n.title}</h3>
                {n.body && <p style={{ marginTop: 6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>{n.body}</p>}
                <p className="muted small" style={{ marginTop: 6 }}>
                  {new Date(n.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            ))}
          </>
        )}


              {(!notices || notices.length === 0) && <><h2>お知らせ (0)</h2><p className="sd-empty">現在のお知らせはありません。</p></>}
            </section>
            </>
          ) },
          { id: "jobs", label: "求人", content: (
            <>
<section id="store-jobs" className="sd-section">
        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
          求人情報 ({jobs?.length ?? 0})
        </h2>
        {(!jobs || jobs.length === 0) && (
          <p className="muted">現在募集中の求人はありません。</p>
        )}
        {jobs?.map((j) => (
          <div className="card" key={j.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <h3>{j.title}</h3>
              {j.job_type && <span className="badge">{j.job_type}</span>}
            </div>
            {j.salary && <p className="muted">{j.salary}</p>}
            {j.description && <p style={{ marginTop: 6, fontSize: 13.5 }}>{j.description}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <form
                action={async () => {
                  "use server";
                  await toggleFavoriteJob(j.id, path);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  {favoriteJobIds.has(j.id) ? "★ お気に入り済み" : "☆ お気に入り"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await applyToJob(j.id, path);
                }}
              >
                <button
                  type="submit"
                  className={`btn ${appliedJobIds.has(j.id) ? "" : "primary"}`}
                  style={{ fontSize: 12.5 }}
                  disabled={appliedJobIds.has(j.id)}
                >
                  {appliedJobIds.has(j.id) ? "応募済み" : "応募する"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await reportJob(j.id, path);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                  通報
                </button>
              </form>
            </div>
          </div>
        ))}


            </section>
            </>
          ) },
        ]} />
        <div className="sd-store-support">
          <Link href="/contact" className="btn">お問い合わせ</Link>
          <form action={async () => { "use server"; await reportStore(store.id, path); }}>
            <button type="submit" className="btn">店舗情報の問題を報告</button>
          </form>
        </div>
      </main>
      <PortalFooter />
      <BottomTabs active="stores" />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/constants";
import {
  toggleFavoriteStore,
  toggleFavoriteJob,
  joinEvent,
  useCoupon,
} from "@/app/member-actions";
import { reportStore, reportJob } from "@/app/report-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { classifyDevice } from "@/lib/device";
import { StorePhotoGallery } from "./store-photo-gallery";
import { ReferenceSlice } from "./reference-slice";
import { DetailTabLink } from "./detail-tab-link";
import { StoreEventFilter } from "./store-event-filter";
import { StoreSchedule } from "./store-schedule";
import { DetailIcon } from "./detail-icon";
import { MenuDetail } from "./menu-detail";
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
        .select("id, title, body, created_at, image_url")
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
        .select("id, name, price, description, image_url")
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
      <main className="container sd-page detail-readable">
        <Link href="/stores" className="breadcrumb">← 店舗を探すに戻る</Link>
        <div className="sd-title-row">
          <div className="sd-title"><h1>{store.name}</h1>
            <span className="badge outline"><DetailIcon name="pin" /> {[store.pref, store.city].filter(Boolean).join(" ")}</span>
            {store.category && <span className="badge">{CATEGORY_LABEL[store.category] ?? store.category}</span>}
          </div>
          <div className="sd-store-contact-bar" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
            {/* 店舗の連絡先・SNS(2026/10、店舗管理画面のメール・LINE・X・
                Instagram欄と連携)。値が入っているものだけアイコンを表示する。 */}
            <div aria-label="店舗の連絡先・SNS" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {store.email && (
                <a href={`mailto:${store.email}`} aria-label="メール" data-store-contact="email" style={{ display: "inline-flex", color: "#63a5ac", width: 28, height: 28 }}>
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M3 4h18a2 2 0 0 1 2 2v1l-11 7L1 7V6a2 2 0 0 1 2-2Zm-2 5.4 10.5 6.7a1 1 0 0 0 1 0L23 9.4V18a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2Z"/></svg>
                </a>
              )}
              {store.line_url && (
                <a href={store.line_url} target="_blank" rel="noopener noreferrer" aria-label="LINE" data-store-contact="line" style={{ display: "inline-flex", width: 28, height: 28 }}>
                  <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#06c755"/><path d="M23 12.4c0-4.1-4-7.4-9-7.4S5 8.3 5 12.4c0 3.7 3.2 6.8 7.5 7.3.3.1.8.3.7.8l-.3 1.7c-.1.5.3.7.7.4C19 19.2 23 16.2 23 12.4Z" fill="white"/><text x="14" y="14" textAnchor="middle" fontSize="5.4" fontWeight="800" fontFamily="Arial,sans-serif" fill="#06c755">LINE</text></svg>
                </a>
              )}
              {store.x_url && (
                <a href={store.x_url} target="_blank" rel="noopener noreferrer" aria-label="X" data-store-contact="x" style={{ display: "inline-flex", color: "#222", width: 28, height: 28 }}>
                  <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-7.4L5.3 22H2.2l8.2-9.4L2.9 2h6.5l4.4 6.7L18.9 2ZM17.8 20h1.7L8.3 4H6.5Z"/></svg>
                </a>
              )}
              {store.instagram_url && (
                <a href={store.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" data-store-contact="instagram" style={{ display: "inline-flex", width: 28, height: 28 }}>
                  <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><defs><linearGradient id="store-instagram-gradient" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#f6b94c"/><stop offset=".45" stopColor="#ed4264"/><stop offset="1" stopColor="#8951c8"/></linearGradient></defs><rect x="1" y="1" width="26" height="26" rx="7" fill="url(#store-instagram-gradient)"/><rect x="6" y="6" width="16" height="16" rx="5" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="14" cy="14" r="4" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="19.5" cy="8.5" r="1.2" fill="white"/></svg>
                </a>
              )}
            </div>
          <form action={async () => { "use server"; await toggleFavoriteStore(store.id, path); }}>
            <button type="submit" className={`btn sd-favorite ${isFavoriteStore ? "is-active" : ""}`}>
              {isFavoriteStore ? "♥ お気に入り済み" : "♡ お気に入りに追加"}
            </button>
          </form>
          </div>
        </div>
        <div className="sd-hero-grid">
          <StorePhotoGallery key={store.id} photos={photos ?? []} name={store.name} reference={store.id === "b56daf2a-4ab1-4ad1-b317-a0387ab3391e"} />
          <aside className="sd-info">
            <dl className="sd-info-list">
              <div><dt><DetailIcon name="clock" />営業時間</dt><dd>{store.hours || "店舗にお問い合わせください"}</dd></div>
              <div><dt><DetailIcon name="train" />最寄り駅</dt><dd>{store.nearest_station || store.station || "最寄り駅は店舗にお問い合わせください"}</dd></div>
              <div><dt><DetailIcon name="pin" />住所</dt><dd>{store.address || [store.pref, store.city].filter(Boolean).join(" ") || "未登録"}</dd></div>
              <div><dt><DetailIcon name="phone" />電話番号</dt><dd>{store.tel ? <a href={`tel:${phone}`}>{store.tel}</a> : "未登録"}</dd></div>
            </dl>
            <div className="sd-contact-actions">
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn primary"><DetailIcon name="pin" />地図・経路を見る</a>
              {phone ? <a href={`tel:${phone}`} className="btn"><DetailIcon name="phone" />電話をかける</a> : <Link href="/contact" className="btn">お問い合わせ</Link>}
            </div>
            {mapEmbedQuery && <iframe className="sd-map" title={store.name + "の所在地"}
              src={"https://maps.google.com/maps?q=" + encodeURIComponent(mapEmbedQuery) + "&output=embed"}
              loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </aside>
        </div>
        <StoreDetailTabs key={store.id} schedule={<StoreSchedule events={events ?? []} />} panels={[
          { id: "menu", label: "料金・メニュー", content: (
            <>
<section id="store-menu" className="sd-section">
              <h2><DetailIcon name="menu" />料金・メニュー{menuItems && menuItems.length > 1 && <DetailTabLink id="menu" />}</h2>
              {menuItems && menuItems.length > 0 && <div className="sd-menu-grid">
                {menuItems.map((item) => <article className={`card sd-menu-card ${/初めて|初心者/.test(item.name) ? "sd-beginner-guide" : ""}`} key={item.id}>
                  {item.image_url ? <img src={item.image_url} alt="" className="sd-menu-thumb" style={{ objectFit: "cover" }} /> : <ReferenceSlice region={[139,533,110,99]} alt="" className="sd-menu-thumb" />}
                  <div className="sd-menu-copy"><h3>{item.name}</h3>
                  {item.price && <p className="sd-menu-price">{String(item.price).replace(/\u3000/g, "\n")}</p>}
                  {item.description && <p className="muted">{item.description}</p>}<MenuDetail name={item.name} price={item.price} description={item.description} /></div>
                </article>)}
                {!menuItems.some(item => /初めて|初心者/.test(item.name)) && <article className="card sd-menu-card sd-beginner-guide">
                  <ReferenceSlice region={[505,533,110,99]} alt="" className="sd-menu-thumb" />
                  <div className="sd-menu-copy"><h3>初めての方へ</h3><p className="muted">ルール説明・遊び方のご案内</p><p className="muted">初心者の方も安心して<br />お楽しみいただけます</p>
                  <MenuDetail name="初めての方へ" description="初めてのご来店やルール説明をご希望の方は、店舗にお問い合わせください。開催予定の初心者向けイベントもご確認いただけます。" /></div>
                </article>}
              </div>}
              {(!menuItems || menuItems.length === 0) && <><p className="sd-empty">料金・メニューは店舗にお問い合わせください。</p></>}
            </section>
            </>
          ) },
          { id: "events", label: "トーナメント・イベント", content: (
            <>
<section id="store-events" className="sd-section">
        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
          <DetailIcon name="trophy" />開催予定のイベント
        </h2>
        {(!events || events.length === 0) && (
          <p className="muted">開催予定のイベントはありません。</p>
        )}
        <StoreEventFilter dates={(events ?? []).map(ev => ev.start_at)}>{(events ?? []).map((ev) => (
          <div className="card sd-event-card" key={ev.id}>
            {ev.start_at && <div className="sd-event-date"><strong>{new Date(ev.start_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" })}</strong><span className="sd-weekday">{new Date(ev.start_at).toLocaleDateString("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" })}</span></div>}
            <div className="sd-event-copy">            <Link href={`/events/${ev.id}`}>
              <h3>{ev.title}</h3>
              {ev.location && <p className="muted">{ev.location}</p>}
            </Link>
{ev.start_at && <p className="muted"><DetailIcon name="clock" /><span>{new Date(ev.start_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })} 開始</span></p>}

            <Link className="btn sd-event-detail" href={`/events/${ev.id}`}>詳細を見る ›</Link>
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
            </form></div>
          </div>
        ))}</StoreEventFilter>

            </section>
            </>
          ) },
          { id: "coupons", label: "クーポン", content: (
            <>
<section id="store-coupons" className="sd-section">
        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
          <DetailIcon name="ticket" />クーポン ({coupons?.length ?? 0})<DetailTabLink id="coupons" />
        </h2>
        {(!coupons || coupons.length === 0) && (
          <p className="muted">現在利用可能なクーポンはありません。</p>
        )}
        {[...(coupons ?? [])].sort((a,b) => Number(b.title.includes("友達")) - Number(a.title.includes("友達"))).map((c) => {
          const limitReached =
            c.usage_limit != null && (c.used_count ?? 0) >= c.usage_limit;
          const alreadyUsed = usedCouponIds.has(c.id);
          return (
            <div className="card sd-coupon-card" key={c.id}>
              <ReferenceSlice region={[869,539,55,55]} alt="" className="sd-coupon-thumb" />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h3>{c.title}</h3>
                {c.discount && <span className="badge">{c.discount}</span>}
              </div>
              <Link className="sd-detail-link sd-coupon-detail" href={`/coupons/${c.id}`}>クーポンの詳細を見る ›</Link>
              {c.description && <p style={{ marginTop: 6, fontSize: 13.5 }}>{c.description}</p>}
              <div className="muted" style={{ marginTop: 6 }}>
                {c.code && <>クーポンコード: {c.code} </>}
                {c.valid_until && <>(有効期限: {c.valid_until})</>}
              </div>
              <Link className="btn primary sd-coupon-view" href={`/coupons/${c.id}`}>クーポンを見る</Link>
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
              <DetailIcon name="notice" />お知らせ ({notices.length})<DetailTabLink id="notices" />
            </h2>
            {notices.map((n) => (
              <div className="card" key={n.id}>
                <h3>{n.title}</h3>
                {n.image_url && (
                  <img
                    src={n.image_url}
                    alt=""
                    style={{ width: "100%", maxWidth: 320, borderRadius: 8, marginTop: 8, objectFit: "cover" }}
                  />
                )}
                {n.body && <p style={{ marginTop: 6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>{n.body}</p>}
                <p className="muted small" style={{ marginTop: 6 }}>
                  {new Date(n.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            ))}
          </>
        )}


              {(!notices || notices.length === 0) && <><h2><DetailIcon name="notice" />お知らせ (0)</h2><p className="sd-empty">現在のお知らせはありません。</p></>}
            </section>
            </>
          ) },
          { id: "jobs", label: "求人", content: (
            <>
<section id="store-jobs" className="sd-section">
        <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>
          <DetailIcon name="briefcase" />求人情報 ({jobs?.length ?? 0})
        </h2>
        {(!jobs || jobs.length === 0) && (
          <p className="muted">現在募集中の求人はありません。</p>
        )}
        {jobs?.map((j) => (
          <div className="card sd-job-card" key={j.id}>
            <Link href={`/jobs/${j.id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h3>{j.title}</h3>
                {j.job_type && <span className="badge">{j.job_type}</span>}
              </div>
              {j.salary && <p className="muted">{j.salary}</p>}
            </Link>
            <Link className="sd-detail-link" href={`/jobs/${j.id}`}>求人の詳細を見る ›</Link>
            <Link href={`/jobs/${j.id}`} className="btn" style={{ fontSize: 12.5, marginTop: 8, display: "inline-flex" }}>
              詳細を見る
            </Link>
            {j.description && <p style={{ marginTop: 6, fontSize: 13.5 }}>{j.description}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
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
              {appliedJobIds.has(j.id) ? (
                <span className="badge good">✓ 応募済み</span>
              ) : (
                <Link href={`/jobs/${j.id}#apply`} className="btn primary" style={{ fontSize: 12.5 }}>
                  応募する
                </Link>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="btn" style={{ fontSize: 12.5 }}>
                  <DetailIcon name="phone" />電話をかける
                </a>
              )}
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
        {store.description && <section className="sd-introduction"><h2>店舗紹介</h2><p>{store.description}</p></section>}
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

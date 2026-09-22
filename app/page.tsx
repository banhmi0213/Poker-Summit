import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  PREF_OPTIONS,
  REGIONS,
} from "@/lib/constants";
import { toggleFavoriteStore } from "./member-actions";
import { PortalHeader } from "./portal-header";
import { PortalFooter } from "./portal-footer";
import { BottomTabs } from "./bottom-tabs";
import { StoreCard } from "./store-card";
import { PrefMap } from "./pref-map";

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

// --- Per-event status for the home page badges: live (started, not yet
// ended) / soon (starts within the next hour) / upcoming (everything else).
function getEventStatus(
  ev: { start_at: string | null; end_at: string | null },
  nowIso: string
): "live" | "soon" | "upcoming" {
  const nowMs = new Date(nowIso).getTime();
  const startMs = ev.start_at ? new Date(ev.start_at).getTime() : null;
  const endMs = ev.end_at ? new Date(ev.end_at).getTime() : null;

  if (startMs !== null && startMs <= nowMs && (endMs === null || endMs >= nowMs)) {
    return "live";
  }
  if (startMs !== null && startMs > nowMs && startMs - nowMs <= 60 * 60 * 1000) {
    return "soon";
  }
  return "upcoming";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; pref?: string; region?: string };
}) {
  const params = searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const pref = params.pref ?? "";
  const region = params.region ?? "";

  const supabase = await createClient();
  const now = new Date().toISOString();

  // All of the following are independent of each other, so they're fired
  // together instead of one-by-one — the serial version of this page was
  // making 12+ round trips to the database back to back, which is what was
  // making the whole site feel slow to load.
  const [
    {
      data: { user },
    },
    { data: prefRows },
    { data: settings },
    { data: banners },
    statsResults,
    { data: featuredStoresRaw },
    { data: latestJobs },
    { data: latestPosts },
    { data: upcomingEvents },
    { data: popularCoupons },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("stores").select("pref").in("status", ["approved", "listed"]),
    supabase.from("site_settings").select("announcement").eq("id", true).maybeSingle(),
    supabase
      .from("banners")
      .select("id, title, image_url, link_url")
      .eq("position", "top")
      .eq("active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("sort_order", { ascending: true }),
    Promise.all([
      supabase
        .from("stores")
        .select("*", { count: "exact", head: true })
        .in("status", ["approved", "listed"]),
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase
        .from("board_posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "visible"),
    ]),
    supabase
      .from("stores")
      .select("id, name, category, pref, city, description, created_at")
      .in("status", ["approved", "listed"])
      .eq("is_recommended", true)
      // Secondary sort by id: created_at alone ties for rows inserted in the
      // same batch, and Postgres doesn't guarantee a stable order for ties.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(4),
    supabase
      .from("jobs")
      .select("id, title, job_type, salary, store_id, stores(name, category)")
      .eq("status", "open")
      .order("posted_at", { ascending: false })
      .limit(3),
    supabase
      .from("board_posts")
      .select("id, title, author_name, created_at")
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("events")
      .select("id, title, location, start_at, end_at, store_id, stores(name)")
      .eq("status", "published")
      .or(`and(end_at.not.is.null,end_at.gte.${now}),and(end_at.is.null,start_at.gte.${now})`)
      .order("start_at", { ascending: true })
      .limit(8),
    supabase
      .from("coupons")
      .select("id, title, discount, valid_until, store_id, stores(name, category)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const [{ count: totalStoreCount }, { count: openJobCount }, { count: threadCount }] =
    statsResults;

  const prefCounts: Record<string, number> = {};
  prefRows?.forEach((r) => {
    if (!r.pref) return;
    prefCounts[r.pref] = (prefCounts[r.pref] ?? 0) + 1;
  });

  // --- Live vs upcoming events: prefer showing what's happening right now,
  // and only fall back to "coming up" events when nothing is live. ---
  const liveEvents = (upcomingEvents ?? []).filter((ev: any) => ev.start_at && ev.start_at <= now).slice(0, 3);
  const nextEvents = (upcomingEvents ?? [])
    .filter((ev: any) => !ev.start_at || ev.start_at > now)
    .slice(0, 3);
  const isEventsLive = liveEvents.length > 0;
  const displayEvents = isEventsLive ? liveEvents : nextEvents;

  // --- Favorites (depends on `user`, so it runs after the batch above) ---
  let favoriteStoreIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorite_stores")
      .select("store_id")
      .eq("user_id", user.id);
    favoriteStoreIds = new Set((favs ?? []).map((f) => f.store_id));
  }

  // --- Featured stores: admin-curated (is_recommended flag in the store
  // management screen), already filtered/ordered/limited server-side above.
  const featuredStores = featuredStoresRaw ?? [];

  // --- Reply counts (depends on latestPosts, so it runs after the batch above) ---
  const postIds = (latestPosts ?? []).map((p) => p.id);
  const { data: replyRows } = postIds.length
    ? await supabase.from("board_replies").select("post_id").in("post_id", postIds)
    : { data: [] as { post_id: string }[] };
  const replyCounts: Record<string, number> = {};
  replyRows?.forEach((r) => {
    replyCounts[r.post_id] = (replyCounts[r.post_id] ?? 0) + 1;
  });

  return (
    <div>
      <PortalHeader userEmail={user?.email} />

      {settings?.announcement && (
        <div className="container" style={{ paddingBottom: 0 }}>
          <div
            className="card"
            style={{
              marginTop: 16,
              background: "var(--accent-soft)",
              borderColor: "var(--accent)",
              fontSize: 13.5,
            }}
          >
            {settings.announcement}
          </div>
        </div>
      )}

      <div className="hero">
        <div className="eyebrow">POKER FOR A NEW TOMORROW</div>
        <h1>全国のポーカースポットを探す</h1>
        <p className="sub">
          アミューズメントポーカー・ポーカーバーを、日本全国から検索できます。
        </p>

        <form method="get" action="/stores" className="search-box">
          {/* category/region are still filterable via URL (e.g. from the
              jobs/category pages or the region chips below), just not shown
              as their own controls here — this form matches the prototype's
              original text + prefecture layout. Submits to the dedicated
              /stores search page rather than staying on the home page. */}
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="region" value={region} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="店名・フリーワードで検索(例: 渋谷, VIP, トーナメント)"
            style={{ flex: "2 1 220px" }}
          />
          <select name="pref" defaultValue={pref} style={{ flex: "1 1 160px" }}>
            <option value="">都道府県を選択</option>
            {PREF_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button type="submit" className="btn primary">
            🔍 検索する
          </button>
        </form>

        {banners && banners.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 760,
              margin: "20px auto 0",
            }}
          >
            {banners.map((b) => {
              const content = (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {b.image_url ? (
                    <img
                      src={b.image_url}
                      alt={b.title}
                      style={{ width: "100%", display: "block" }}
                    />
                  ) : (
                    <div style={{ padding: 16 }}>{b.title}</div>
                  )}
                </div>
              );
              return b.link_url ? (
                <a href={`/go/banner/${b.id}`} key={b.id} target="_blank" rel="noreferrer">
                  {content}
                </a>
              ) : (
                <div key={b.id}>{content}</div>
              );
            })}
          </div>
        )}

        <p className="tagline">
          ポーカーがつなぐ、新しい出会いを。日本のすみずみまで。
          <br />
          全国47の地で、ポーカーと出会える。
        </p>
        <PrefMap prefCounts={prefCounts} q={q} category={category} initialPref={pref} />
        <p className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 10 }}>
          <span style={{ color: "var(--accent-text)" }}>■</span> 掲載店舗あり ・ 枠のみ = 今後拡大予定 ・
          タップすると店舗数を表示
        </p>

        <div className="chip-row" style={{ justifyContent: "center", marginTop: 20 }}>
          {REGIONS.map((r) => (
            <a
              key={r}
              href={`/stores?region=${encodeURIComponent(r)}`}
              className={`chip ${region === r ? "active" : ""}`}
            >
              {r}
            </a>
          ))}
        </div>

        <div className="stats-row">
          <div className="item">
            <div className="num">{totalStoreCount ?? 0}</div>
            <div className="lbl">👑 全国の掲載店舗</div>
          </div>
          <div className="item">
            <div className="num">{openJobCount ?? 0}</div>
            <div className="lbl">👤 掲載求人</div>
          </div>
          <div className="item">
            <div className="num">{threadCount ?? 0}</div>
            <div className="lbl">💬 スレッド</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>🏆 PICK UP店舗</h2>
          <Link href="/stores/featured" className="see-all">
            すべて見る →
          </Link>
        </div>
        {featuredStores.length === 0 && <p className="muted">まだ店舗がありません。</p>}
        <div className="grid cols-4">
          {featuredStores.map((s) => (
            <StoreCard
              key={s.id}
              store={s}
              isFavorite={favoriteStoreIds.has(s.id)}
              favoriteAction={async () => {
                "use server";
                await toggleFavoriteStore(s.id, "/");
              }}
            />
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>💼 新着求人</h2>
          <Link href="/jobs" className="see-all">
            すべて見る →
          </Link>
        </div>
        {(!latestJobs || latestJobs.length === 0) && (
          <p className="muted">現在募集中の求人はありません。</p>
        )}
        {latestJobs && latestJobs.length > 0 && (
          <div className="grid cols-3">
            {latestJobs.map((j: any) => (
              <Link href={`/stores/${j.store_id}`} key={j.id} className="card" style={{ display: "block" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  {j.stores?.category && (
                    <span className="badge">{CATEGORY_LABEL[j.stores.category] ?? j.stores.category}</span>
                  )}
                  {j.job_type && <span className="badge">{j.job_type}</span>}
                </div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{j.title}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{j.stores?.name}</div>
                {j.salary && (
                  <div style={{ marginTop: 6, fontWeight: 700, color: "var(--accent-text)", fontSize: 13 }}>
                    {j.salary}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>💬 盛り上がっているサミット</h2>
          <Link href="/board" className="see-all">
            すべて見る →
          </Link>
        </div>
        {(!latestPosts || latestPosts.length === 0) && (
          <p className="muted">まだ投稿がありません。</p>
        )}
        {latestPosts && latestPosts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {latestPosts.map((p) => (
              <Link href={`/board/${p.id}`} key={p.id} className="card" style={{ display: "block" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {p.author_name} ・ {formatDateTime(p.created_at)} ・ 💬 {replyCounts[p.id] ?? 0}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>
            {isEventsLive ? "🔥本日 開催中のトーナメント・イベント" : "📅 開催予定のトーナメント・イベント"}
          </h2>
          <Link href="/events" className="see-all">
            すべて見る →
          </Link>
        </div>
        {displayEvents.length === 0 && (
          <p className="muted">現在開催予定のイベントはありません。</p>
        )}
        {displayEvents.length > 0 && (
          <div className="grid cols-3">
            {displayEvents.map((ev: any) => {
              const status = getEventStatus(ev, now);
              return (
                <Link href={`/events/${ev.id}`} key={ev.id} className="card" style={{ display: "block" }}>
                  {status === "live" && (
                    <span className="badge accent" style={{ marginBottom: 6 }}>
                      🔥 開催中
                    </span>
                  )}
                  {status === "soon" && (
                    <span className="badge warning" style={{ marginBottom: 6 }}>
                      ⏰ まもなく
                    </span>
                  )}
                  {status === "upcoming" && (
                    <span className="badge" style={{ marginBottom: 6 }}>
                      📅 開催予定
                    </span>
                  )}
                  <div style={{ fontWeight: 700, marginTop: 4, marginBottom: 4 }}>{ev.title}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {[ev.stores?.name, ev.location].filter(Boolean).join(" ・ ")}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>🎟️ 人気のクーポン</h2>
          <Link href="/coupons" className="see-all">
            すべて見る →
          </Link>
        </div>
        {(!popularCoupons || popularCoupons.length === 0) && (
          <p className="muted">現在利用可能なクーポンはありません。</p>
        )}
        {popularCoupons && popularCoupons.length > 0 && (
          <div className="grid cols-4">
            {popularCoupons.map((c: any) => (
              <Link
                href={`/stores/${c.store_id}`}
                key={c.id}
                className="card"
                style={{ padding: 0, overflow: "hidden", display: "block" }}
              >
                <div
                  style={{
                    background: CATEGORY_COLOR[c.stores?.category ?? ""] ?? "#c98500",
                    height: 60,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                  }}
                >
                  🎟️
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.title}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {c.stores?.name} ・ {formatDate(c.valid_until)}まで
                  </div>
                  {c.discount && (
                    <span className="badge" style={{ marginTop: 6 }}>
                      {c.discount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="cta-banner">
        <div className="cta-banner-inner">
          <div className="cta-icon" style={{ fontSize: 32 }}>
            🃏
          </div>
          <div className="cta-body">
            <div className="eyebrow">POKER LOVERS COMMUNITY</div>
            <h2>ポーカー好きと、もっとつながる。</h2>
            <p>会員登録して、店舗情報や求人、全国の仲間との情報交換を楽しもう。</p>
            {user ? (
              <Link href="/mypage" className="btn-outline-gold">
                マイページへ
              </Link>
            ) : (
              <Link href="/signup" className="btn-outline-gold">
                無料で会員登録
              </Link>
            )}
          </div>
        </div>
      </div>

      <PortalFooter />
      <BottomTabs active="home" />
    </div>
  );
}
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  CATEGORY_COLOR,
  PREF_OPTIONS,
  REGIONS,
} from "@/lib/constants";
import { toggleFavoriteStore } from "./member-actions";
import { pickBanner } from "@/lib/banners";
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

  let storesQuery = supabase
    .from("stores")
    .select("id, name, category, region, pref, city, description, status")
    .in("status", ["approved", "listed"])
    .order("created_at", { ascending: false });

  if (q) {
    storesQuery = storesQuery.ilike("name", `%${q}%`);
  }
  if (category) {
    storesQuery = storesQuery.eq("category", category);
  }
  if (pref) {
    storesQuery = storesQuery.eq("pref", pref);
  }
  if (region) {
    storesQuery = storesQuery.eq("region", region);
  }

  // All of the following are independent of each other, so they're fired
  // together instead of one-by-one — the serial version of this page was
  // making 12+ round trips to the database back to back, which is what was
  // making the whole site feel slow to load.
  const [
    {
      data: { user },
    },
    { data: stores },
    { data: prefRows },
    { data: settings },
    { data: banners },
    statsResults,
    { data: allStoresForFeature },
    { data: allFavRows },
    { data: latestJobs },
    { data: latestPosts },
    { data: upcomingEvents },
    { data: popularCoupons },
    storeListBanner,
  ] = await Promise.all([
    supabase.auth.getUser(),
    storesQuery,
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
      .in("status", ["approved", "listed"]),
    supabase.from("favorite_stores").select("store_id"),
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
      .select("id, title, location, start_at, store_id, stores(name)")
      .eq("status", "published")
      .gte("start_at", now)
      .order("start_at", { ascending: true })
      .limit(3),
    supabase
      .from("coupons")
      .select("id, title, discount, valid_until, store_id, stores(name, category)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(4),
    pickBanner(supabase, "store_list", { pref, region }),
  ]);

  const [{ count: totalStoreCount }, { count: openJobCount }, { count: threadCount }] =
    statsResults;

  const prefCounts: Record<string, number> = {};
  prefRows?.forEach((r) => {
    if (!r.pref) return;
    prefCounts[r.pref] = (prefCounts[r.pref] ?? 0) + 1;
  });

  // --- Favorites (depends on `user`, so it runs after the batch above) ---
  let favoriteStoreIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorite_stores")
      .select("store_id")
      .eq("user_id", user.id);
    favoriteStoreIds = new Set((favs ?? []).map((f) => f.store_id));
  }

  // --- Featured stores (by favorite count) ---
  const likeCounts: Record<string, number> = {};
  allFavRows?.forEach((r) => {
    likeCounts[r.store_id] = (likeCounts[r.store_id] ?? 0) + 1;
  });
  const featuredStores = [...(allStoresForFeature ?? [])]
    .sort((a, b) => {
      const diff = (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0);
      if (diff !== 0) return diff;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    })
    .slice(0, 4);

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
      <div className="container">
        {settings?.announcement && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              background: "var(--accent-soft)",
              borderColor: "var(--accent)",
              fontSize: 13.5,
            }}
          >
            {settings.announcement}
          </div>
        )}

        {banners && banners.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
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

        <div className="muted" style={{ fontSize: 12, letterSpacing: "0.08em", marginBottom: 6 }}>
          POKER FOR A NEW TOMORROW
        </div>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>全国のポーカースポットを探す</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          アミューズメントポーカー・ポーカーバーを、日本全国から検索できます。
        </p>

        <form
          method="get"
          className="card"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginBottom: 16,
          }}
        >
          <div className="field" style={{ marginBottom: 0, flex: "1 1 180px" }}>
            <span className="muted">店舗名で検索</span>
            <input type="text" name="q" defaultValue={q} placeholder="店名・キーワード" />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
            <span className="muted">カテゴリ</span>
            <select name="category" defaultValue={category}>
              <option value="">すべて</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
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
          <div className="field" style={{ marginBottom: 0, flex: "1 1 140px" }}>
            <span className="muted">地方</span>
            <select name="region" defaultValue={region}>
              <option value="">すべて</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn primary">
            🔍 検索する
          </button>
        </form>

        <a
          href="/apply"
          className="btn"
          style={{ marginBottom: 20, display: "inline-flex" }}
        >
          掲載のお申込みはこちら
        </a>

        <p className="muted" style={{ marginBottom: 6, fontSize: 13.5, textAlign: "center" }}>
          ポーカーがつなぐ、新しい出会いを。日本のすみずみまで。
          <br />
          全国47の地で、ポーカーと出会える。
        </p>
        <PrefMap prefCounts={prefCounts} q={q} category={category} initialPref={pref} />
        <p className="muted" style={{ fontSize: 11.5, textAlign: "center", marginBottom: 20 }}>
          <span style={{ color: "var(--accent-text)" }}>■</span> 掲載店舗あり ・ 枠のみ = 今後拡大予定 ・
          タップすると店舗数を表示
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 }}>
          {REGIONS.map((r) => (
            <a
              key={r}
              href={`/?region=${encodeURIComponent(r)}#store-list`}
              className={`btn ${region === r ? "primary" : ""}`}
              style={{ fontSize: 12.5 }}
            >
              {r}
            </a>
          ))}
        </div>

        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-around",
            textAlign: "center",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{totalStoreCount ?? 0}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>👑 全国の掲載店舗</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{openJobCount ?? 0}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>👤 掲載求人</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{threadCount ?? 0}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>💬 スレッド</div>
          </div>
        </div>

        {/* 🏆 注目店舗 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>🏆 注目店舗</h2>
          <a href="#store-list" className="muted" style={{ fontSize: 13 }}>
            すべて見る →
          </a>
        </div>
        {featuredStores.length === 0 && <p className="muted">まだ店舗がありません。</p>}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {featuredStores.map((s) => (
            <StoreCard key={s.id} store={s} likeCount={likeCounts[s.id] ?? 0} />
          ))}
        </div>

        {/* 💼 新着求人 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>💼 新着求人</h2>
          <Link href="/jobs" className="muted" style={{ fontSize: 13 }}>
            すべて見る →
          </Link>
        </div>
        {(!latestJobs || latestJobs.length === 0) && (
          <p className="muted" style={{ marginBottom: 28 }}>
            現在募集中の求人はありません。
          </p>
        )}
        {latestJobs && latestJobs.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 28,
            }}
          >
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

        {/* 💬 盛り上がっているサミット */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>💬 盛り上がっているサミット</h2>
          <Link href="/board" className="muted" style={{ fontSize: 13 }}>
            すべて見る →
          </Link>
        </div>
        {(!latestPosts || latestPosts.length === 0) && (
          <p className="muted" style={{ marginBottom: 28 }}>
            まだ投稿がありません。
          </p>
        )}
        {latestPosts && latestPosts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
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

        {/* 🎉 開催予定のイベント */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>🎉 開催予定のイベント</h2>
          <Link href="/events" className="muted" style={{ fontSize: 13 }}>
            すべて見る →
          </Link>
        </div>
        {(!upcomingEvents || upcomingEvents.length === 0) && (
          <p className="muted" style={{ marginBottom: 28 }}>
            現在開催予定のイベントはありません。
          </p>
        )}
        {upcomingEvents && upcomingEvents.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 28,
            }}
          >
            {upcomingEvents.map((ev: any) => (
              <Link href={`/events/${ev.id}`} key={ev.id} className="card" style={{ display: "block" }}>
                <span className="badge" style={{ marginBottom: 6 }}>
                  {formatDate(ev.start_at)}
                </span>
                <div style={{ fontWeight: 700, marginTop: 4, marginBottom: 4 }}>{ev.title}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {[ev.stores?.name, ev.location].filter(Boolean).join(" ・ ")}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 🎟️ 人気のクーポン */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>🎟️ 人気のクーポン</h2>
          <Link href="/coupons" className="muted" style={{ fontSize: 13 }}>
            すべて見る →
          </Link>
        </div>
        {(!popularCoupons || popularCoupons.length === 0) && (
          <p className="muted" style={{ marginBottom: 28 }}>
            現在利用可能なクーポンはありません。
          </p>
        )}
        {popularCoupons && popularCoupons.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 28,
            }}
          >
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

        {/* コミュニティCTA */}
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "32px 20px",
            marginBottom: 32,
            background: "var(--accent-soft)",
          }}
        >
          <div className="muted" style={{ fontSize: 12, letterSpacing: "0.08em", marginBottom: 6 }}>
            POKER LOVERS COMMUNITY
          </div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>ポーカー好きと、もっとつながる。</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            会員登録して、店舗情報や求人、全国の仲間との情報交換を楽しもう。
          </p>
          {user ? (
            <Link href="/mypage" className="btn primary">
              マイページへ
            </Link>
          ) : (
            <Link href="/signup" className="btn primary">
              無料で会員登録
            </Link>
          )}
        </div>

        <div id="store-list" />
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>店舗を探す</h2>
        {(!stores || stores.length === 0) && (
          <p className="muted">条件に一致する店舗はありません。</p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {stores?.map((s) => (
            <div key={s.id}>
              <StoreCard store={s} likeCount={likeCounts[s.id] ?? 0} />
              <form
                action={async () => {
                  "use server";
                  await toggleFavoriteStore(s.id, "/");
                }}
                style={{ marginTop: 6 }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12, width: "100%" }}>
                  {favoriteStoreIds.has(s.id) ? "★ お気に入り済み" : "☆ お気に入りに追加"}
                </button>
              </form>
            </div>
          ))}
        </div>

        {storeListBanner && (
          <a
            href={`/go/banner/${storeListBanner.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", maxWidth: 760, margin: "24px auto 0" }}
          >
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {storeListBanner.image_url ? (
                <img src={storeListBanner.image_url} alt={storeListBanner.title} style={{ width: "100%", display: "block" }} />
              ) : (
                <div style={{ padding: 16 }}>{storeListBanner.title}</div>
              )}
            </div>
          </a>
        )}
      </div>
      <PortalFooter />
      <BottomTabs active="home" />
    </div>
  );
}

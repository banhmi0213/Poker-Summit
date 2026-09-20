import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, CATEGORY_OPTIONS, PREF_OPTIONS } from "@/lib/constants";
import { toggleFavoriteStore } from "./member-actions";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; pref?: string };
}) {
  const params = searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const pref = params.pref ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("stores")
    .select("id, name, category, region, pref, city, description, status")
    .in("status", ["approved", "listed"])
    .order("created_at", { ascending: false });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (pref) {
    query = query.eq("pref", pref);
  }

  const { data: stores } = await query;

  let favoriteStoreIds = new Set<string>();
  if (user) {
    const { data: favs } = await supabase
      .from("favorite_stores")
      .select("store_id")
      .eq("user_id", user.id);
    favoriteStoreIds = new Set((favs ?? []).map((f) => f.store_id));
  }

  const now = new Date().toISOString();
  const { data: banners } = await supabase
    .from("banners")
    .select("id, title, image_url, link_url")
    .eq("position", "top")
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true });

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/events" className="btn">
            イベント
          </Link>
          <Link href="/jobs" className="btn">
            求人
          </Link>
          <Link href="/coupons" className="btn">
            クーポン
          </Link>
          <Link href="/board" className="btn">
            掲示板
          </Link>
          <Link href="/contact" className="btn">
            お問い合わせ
          </Link>
          {user ? (
            <Link href="/mypage" className="btn">
              マイページ
            </Link>
          ) : (
            <Link href="/signup" className="btn">
              会員登録/ログイン
            </Link>
          )}
          <Link href="/login" className="btn">
            店舗・運営ログイン
          </Link>
        </div>
      </header>
      <div className="container">
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

        <h1 style={{ fontSize: 24, marginBottom: 6 }}>店舗を探す</h1>
        <p className="muted" style={{ marginBottom: 12 }}>
          全国のポーカースポットを掲載しています。
        </p>
        <a
          href="/apply"
          className="btn"
          style={{ marginBottom: 20, display: "inline-flex" }}
        >
          掲載のお申込みはこちら
        </a>

        <form
          method="get"
          className="card"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginBottom: 20,
          }}
        >
          <div className="field" style={{ marginBottom: 0, flex: "1 1 180px" }}>
            <span className="muted">店舗名で検索</span>
            <input type="text" name="q" defaultValue={q} placeholder="店舗名" />
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
          <button type="submit" className="btn primary">
            検索
          </button>
        </form>

        {(!stores || stores.length === 0) && (
          <p className="muted">条件に一致する店舗はありません。</p>
        )}

        {stores?.map((s) => (
          <div className="card" key={s.id}>
            <Link href={`/stores/${s.id}`} style={{ display: "block" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <h3>{s.name}</h3>
                {s.category && (
                  <span className="badge">
                    {CATEGORY_LABEL[s.category] ?? s.category}
                  </span>
                )}
              </div>
              <div className="muted">
                {[s.region, s.pref, s.city].filter(Boolean).join(" / ")}
              </div>
              {s.description && (
                <p style={{ marginTop: 8, fontSize: 13.5 }}>{s.description}</p>
              )}
            </Link>
            <form
              action={async () => {
                "use server";
                await toggleFavoriteStore(s.id, "/");
              }}
              style={{ marginTop: 8 }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                {favoriteStoreIds.has(s.id) ? "★ お気に入り済み" : "☆ お気に入りに追加"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

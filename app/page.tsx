import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, CATEGORY_OPTIONS, PREF_OPTIONS } from "@/lib/constants";

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

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/jobs" className="btn">
            求人
          </Link>
          <Link href="/coupons" className="btn">
            クーポン
          </Link>
          <Link href="/login" className="btn">
            店舗・運営ログイン
          </Link>
        </div>
      </header>
      <div className="container">
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
          <Link href={`/stores/${s.id}`} key={s.id} style={{ display: "block" }}>
            <div className="card">
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
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

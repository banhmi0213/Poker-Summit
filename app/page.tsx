import { createClient } from "@/lib/supabase/server";

const CATEGORY_LABEL: Record<string, string> = {
  amusement: "アミューズメントポーカー",
  bar: "ポーカーバー",
  casino: "カジノバー",
  school: "ポーカースクール",
  tournament: "トーナメント会場",
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, category, region, pref, city, description, status")
    .in("status", ["approved", "listed"])
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="header">
        <div className="brand">Poker Summit</div>
        <a href="/login" className="btn">
          店舗・運営ログイン
        </a>
      </header>
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>店舗を探す</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          全国のポーカースポットを掲載しています。
        </p>

        {(!stores || stores.length === 0) && (
          <p className="muted">現在掲載中の店舗はありません。</p>
        )}

        {stores?.map((s) => (
          <div className="card" key={s.id}>
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
        ))}
      </div>
    </div>
  );
}

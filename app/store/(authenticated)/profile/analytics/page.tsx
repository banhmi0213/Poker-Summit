import { fetchAllRows } from "@/lib/fetch-all-rows";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";

// 日本時間の日付で区切る
function dayKey(d: Date) {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function StoreAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/analytics");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    return (
      <div className="container">
        <p className="err">このアカウントに紐づく店舗が見つかりません。</p>
      </div>
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 14);

  // 1,000件を超えても取り切る(lib/fetch-all-rows.ts)
  const { data: views } = await fetchAllRows<{ created_at: string; referrer: string | null }>(() =>
    supabase
      .from("page_views")
      .select("created_at, referrer")
      .eq("store_id", store.id)
      .gte("created_at", since.toISOString())
  );

  const { count: totalViews } = await supabase
    .from("page_views")
    .select("*", { count: "exact", head: true })
    .eq("store_id", store.id);

  // 全店舗の閲覧記録は店舗からは読めないため、件数だけ返す関数で取る(2026/10)
  const { data: sitewideViewsRaw } = await supabase.rpc("sitewide_store_view_count");
  const sitewideViews = Number(sitewideViewsRaw ?? 0);

  const { count: totalStores } = await supabase
    .from("stores")
    .select("*", { count: "exact", head: true })
    .in("status", ["approved", "listed"]);

  // お気に入り数(店舗・求人・クーポン)。お気に入りの表は店舗からは直接読めないため、
  // 件数だけ返す関数で取る(2026/10、クーポンは「使用回数」から「お気に入り数」に変更)。
  const { data: favCounts } = await supabase.rpc("store_favorite_counts", { p_store_id: store.id });
  const fc = (favCounts ?? {}) as { store?: number; jobs?: number; coupons?: number };
  const favoriteCount = Number(fc.store ?? 0);
  const jobFavoriteCount = Number(fc.jobs ?? 0);
  const couponFavoriteCount = Number(fc.coupons ?? 0);

  const avgViewsPerStore =
    totalStores && totalStores > 0
      ? Math.round(((sitewideViews ?? 0) / totalStores) * 10) / 10
      : 0;

  const dailyCounts = new Map<string, number>();
  // 今日を含む直近14日(以前は今日が抜けて「15日前〜昨日」になっていた)
  for (let i = 1; i <= 14; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dailyCounts.set(dayKey(d), 0);
  }
  views?.forEach((v) => {
    const key = dayKey(new Date(v.created_at));
    if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  });
  const dailyList = Array.from(dailyCounts.entries());
  const maxDaily = Math.max(1, ...dailyList.map(([, c]) => c));

  const referrerCounts = new Map<string, number>();
  views?.forEach((v) => {
    let source = "直接アクセス / 不明";
    if (v.referrer) {
      try {
        source = new URL(v.referrer).hostname;
      } catch {
        source = v.referrer;
      }
    }
    referrerCounts.set(source, (referrerCounts.get(source) ?? 0) + 1);
  });
  const topReferrers = Array.from(referrerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        店舗情報編集へ戻る
      </Link>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>{store.name} のアクセス統計</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="card">
          <div className="muted">累計閲覧数</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
            {totalViews ?? 0}
          </div>
        </div>
        <div className="card">
          <div className="muted">直近14日間の閲覧数</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
            {views?.length ?? 0}
          </div>
        </div>
        <div className="card">
          <div className="muted">他店舗と比較（全店舗平均）</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
            {avgViewsPerStore}
          </div>
          <div className="muted">件（累計・店舗あたり平均）</div>
        </div>
        <div className="card">
          <div className="muted">お気に入り数</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
            ♥ {favoriteCount ?? 0}
          </div>
        </div>
        <div className="card">
          <div className="muted">求人のお気に入り数（全求人合計）</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
            ★ {jobFavoriteCount}
          </div>
        </div>
        <div className="card">
          <div className="muted">クーポンのお気に入り数（全クーポン合計）</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
            ♥ {couponFavoriteCount}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>今週の閲覧数の推移（日次）</h2>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
          {dailyList.map(([day, count], idx) => (
            <div
              key={day}
              style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              title={`${day}: ${count}件`}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(2, (count / maxDaily) * 90)}px`,
                  background: "var(--accent-gradient)",
                  borderRadius: 3,
                }}
              />
              {/* 日数が多いときは日付を間引いて、重なり・はみ出しを防ぐ */}
              <span style={{ fontSize: 10.5, color: "var(--muted)", whiteSpace: "nowrap", minHeight: 14 }}>
                {idx % Math.ceil(dailyList.length / 7) === 0 || idx === dailyList.length - 1 ? `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>流入経路</h2>
      {topReferrers.length === 0 && (
        <p className="muted">まだデータがありません。</p>
      )}
      {topReferrers.map(([source, count]) => (
        <div className="card" key={source}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{source}</span>
            <span className="badge">{count}件</span>
          </div>
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/constants";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 13);

  // All 13 of these are independent of each other, so fire them together
  // instead of one-by-one — this page used to make a dozen round trips to
  // the database back to back, which is what was making it feel slow.
  const [
    { count: totalStores },
    { count: pendingStores },
    { count: pendingApplications },
    { count: openJobs },
    { count: activeCoupons },
    { count: unreadInquiries },
    { count: openReports },
    { count: totalViews },
    { data: recentViews },
    { data: recentAllViews },
    { data: storesForCategory },
    { data: banners },
    { data: clicks },
  ] = await Promise.all([
    supabase.from("stores").select("*", { count: "exact", head: true }),
    supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("listing_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("coupons")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .eq("status", "unread"),
    supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase.from("page_views").select("*", { count: "exact", head: true }),
    supabase
      .from("page_views")
      .select("store_id, stores(name)")
      .not("store_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("page_views").select("created_at").gte("created_at", since.toISOString()),
    supabase.from("stores").select("category").in("status", ["approved", "listed"]),
    supabase.from("banners").select("id, title"),
    supabase.from("banner_clicks").select("banner_id"),
  ]);

  const viewCounts = new Map<string, { name: string; count: number }>();
  recentViews?.forEach((v: any) => {
    if (!v.store_id) return;
    const key = v.store_id;
    const name = v.stores?.name ?? "(不明な店舗)";
    const current = viewCounts.get(key);
    viewCounts.set(key, { name, count: (current?.count ?? 0) + 1 });
  });
  const topViewedStores = Array.from(viewCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const dailyCounts = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dailyCounts.set(dayKey(d), 0);
  }
  recentAllViews?.forEach((v) => {
    const key = dayKey(new Date(v.created_at));
    if (dailyCounts.has(key)) {
      dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
    }
  });
  const dailyList = Array.from(dailyCounts.entries());
  const maxDaily = Math.max(1, ...dailyList.map(([, c]) => c));

  const categoryCounts = new Map<string, number>();
  storesForCategory?.forEach((s) => {
    const key = s.category ?? "未分類";
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  });
  const categoryList = Array.from(categoryCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  const clickCounts = new Map<string, number>();
  clicks?.forEach((c) => {
    clickCounts.set(c.banner_id, (clickCounts.get(c.banner_id) ?? 0) + 1);
  });
  const bannerStats = (banners ?? [])
    .map((b) => ({ title: b.title, count: clickCounts.get(b.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const stats = [
    { label: "登録店舗数", value: totalStores ?? 0, href: "/admin/stores" },
    { label: "承認待ち店舗", value: pendingStores ?? 0, href: "/admin/stores" },
    {
      label: "未対応の掲載申込",
      value: pendingApplications ?? 0,
      href: "/admin/listing-applications",
    },
    { label: "募集中の求人", value: openJobs ?? 0, href: "/jobs" },
    { label: "公開中のクーポン", value: activeCoupons ?? 0, href: "/coupons" },
    {
      label: "未読のお問い合わせ",
      value: unreadInquiries ?? 0,
      href: "/admin/inquiries",
    },
    {
      label: "未対応の通報",
      value: openReports ?? 0,
      href: "/admin/reports",
    },
    {
      label: "店舗詳細の閲覧数（累計）",
      value: totalViews ?? 0,
      href: "/admin/audit-log",
    },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>ダッシュボード</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {stats.map((s) => (
          <Link href={s.href} key={s.label} style={{ display: "block" }}>
            <div className="card">
              <div className="muted">{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>
                {s.value}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: 28 }}>
        <Link href="/admin/analytics" className="btn primary">
          📈 アクセス分析を見る →
        </Link>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>
        よく見られている店舗（直近200件のアクセスより）
      </h2>
      {topViewedStores.length === 0 && (
        <p className="muted">まだアクセスデータがありません。</p>
      )}
      {topViewedStores.map((s) => (
        <div className="card" key={s.name}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{s.name}</span>
            <span className="badge">{s.count}回</span>
          </div>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
        今週の閲覧数の推移（日次・全体）
      </h2>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
          {dailyList.map(([day, count]) => (
            <div
              key={day}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
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
              <span style={{ fontSize: 9.5, color: "var(--muted)" }}>
                {day.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
        カテゴリ別 掲載店舗数
      </h2>
      {categoryList.map(([cat, count]) => (
        <div className="card" key={cat}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{CATEGORY_LABEL[cat] ?? cat}</span>
            <span className="badge">{count}店舗</span>
          </div>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
        バナー別クリック数
      </h2>
      {bannerStats.length === 0 && (
        <p className="muted">まだバナーがありません。</p>
      )}
      {bannerStats.map((b) => (
        <div className="card" key={b.title}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{b.title}</span>
            <span className="badge">{b.count}クリック</span>
          </div>
        </div>
      ))}
    </div>
  );
}

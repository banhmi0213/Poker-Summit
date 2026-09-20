import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalStores },
    { count: pendingStores },
    { count: pendingApplications },
    { count: openJobs },
    { count: activeCoupons },
    { count: unreadInquiries },
    { count: openReports },
    { count: totalViews },
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
      .from("board_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase.from("page_views").select("*", { count: "exact", head: true }),
  ]);

  const { data: recentViews } = await supabase
    .from("page_views")
    .select("store_id, stores(name)")
    .not("store_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

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
      label: "未対応の掲示板通報",
      value: openReports ?? 0,
      href: "/admin/board",
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
    </div>
  );
}

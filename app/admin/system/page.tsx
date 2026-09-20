import { createClient } from "@/lib/supabase/server";

async function getCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  filter?: (q: any) => any
) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count } = await query;
  return count ?? 0;
}

export default async function AdminSystemPage() {
  const supabase = await createClient();

  const [
    stores,
    listingApplications,
    jobs,
    coupons,
    events,
    boardPosts,
    boardReplies,
    inquiries,
    auditLog,
    pageViews,
    ngWords,
    admins,
  ] = await Promise.all([
    getCount(supabase, "stores"),
    getCount(supabase, "listing_applications"),
    getCount(supabase, "jobs"),
    getCount(supabase, "coupons"),
    getCount(supabase, "events"),
    getCount(supabase, "board_posts"),
    getCount(supabase, "board_replies"),
    getCount(supabase, "inquiries"),
    getCount(supabase, "audit_log"),
    getCount(supabase, "page_views"),
    getCount(supabase, "ng_words"),
    getCount(supabase, "admin_users"),
  ]);

  // データ整合性チェック: 明らかにおかしい状態のレコードを軽く検出する
  const issues: string[] = [];

  const { data: unclaimedListed } = await supabase
    .from("stores")
    .select("id, name")
    .eq("status", "listed")
    .is("owner_user_id", null);
  unclaimedListed?.forEach((s) =>
    issues.push(`掲載済みなのにオーナー未設定の店舗: ${s.name}`)
  );

  const { data: approvedNoStore } = await supabase
    .from("listing_applications")
    .select("id, company_name")
    .eq("status", "approved")
    .is("store_id", null);
  approvedNoStore?.forEach((a) =>
    issues.push(`承認済みだが店舗が作成されていない申込: ${a.company_name}`)
  );

  const { data: staleActiveCoupons } = await supabase
    .from("coupons")
    .select("id, title, valid_until")
    .eq("active", true)
    .lt("valid_until", new Date().toISOString().slice(0, 10));
  staleActiveCoupons?.forEach((c) =>
    issues.push(`有効期限切れなのに公開中のクーポン: ${c.title}`)
  );

  const { data: stalePublishedEvents } = await supabase
    .from("events")
    .select("id, title, end_at")
    .eq("status", "published")
    .not("end_at", "is", null)
    .lt("end_at", new Date().toISOString());
  stalePublishedEvents?.forEach((e) =>
    issues.push(`終了日時を過ぎているのに公開中のイベント: ${e.title}`)
  );

  const stats = [
    { label: "店舗", value: stores },
    { label: "掲載申込", value: listingApplications },
    { label: "求人", value: jobs },
    { label: "クーポン", value: coupons },
    { label: "イベント", value: events },
    { label: "掲示板投稿", value: boardPosts },
    { label: "掲示板返信", value: boardReplies },
    { label: "お問い合わせ", value: inquiries },
    { label: "操作ログ", value: auditLog },
    { label: "ページビュー", value: pageViews },
    { label: "NGワード", value: ngWords },
    { label: "管理者アカウント", value: admins },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>システム情報</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {stats.map((s) => (
          <div className="card" key={s.label}>
            <div className="muted">{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>データ整合性チェック</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        店舗・申込・クーポン・イベントの関連に問題がないか確認します。
      </p>
      {issues.length === 0 ? (
        <div className="card">
          <span className="badge">問題なし</span>
        </div>
      ) : (
        issues.map((issue, i) => (
          <div className="card" key={i}>
            <span className="err" style={{ margin: 0 }}>{issue}</span>
          </div>
        ))
      )}
    </div>
  );
}

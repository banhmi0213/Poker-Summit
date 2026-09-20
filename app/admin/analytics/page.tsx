import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, CATEGORY_OPTIONS } from "@/lib/constants";
import {
  analyticsPeriodDays,
  analyticsPeriodLabel,
  analyticsSince,
  bucketTrend,
  trendGranularityLabel,
  type AnalyticsIssue,
} from "@/lib/analytics";
import { classifyReferrer } from "@/lib/referrer";

type SP = {
  tab?: string;
  scope?: string;
  storeId?: string;
  compare?: string;
  period?: string;
  from?: string;
  to?: string;
  q?: string;
  category?: string;
  sort?: string;
};

function hrefWith(sp: SP, overrides: Partial<SP>) {
  const merged: SP = { ...sp, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const qs = params.toString();
  return `/admin/analytics${qs ? `?${qs}` : ""}`;
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12.5 }}>
        <span>{label}</span>
        <span className="tabular muted">{value.toLocaleString()}</span>
      </div>
      <div style={{ height: 10, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function Sparkline({ counts, labels }: { counts: number[]; labels: string[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
      {counts.map((c, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${labels[i]}: ${c}件`}>
          <div
            style={{
              width: "100%",
              height: `${Math.max(2, (c / max) * 84)}px`,
              background: "var(--accent-gradient, var(--accent))",
              borderRadius: 3,
            }}
          />
          <span style={{ fontSize: 9.5 }} className="muted">
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 12.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }} className="tabular">
        {value}
      </div>
      {delta && <div className="muted" style={{ fontSize: 12 }}>{delta}</div>}
    </div>
  );
}

async function computeIssues(supabase: any): Promise<AnalyticsIssue[]> {
  const issues: AnalyticsIssue[] = [];

  const { data: pendingStores } = await supabase.from("stores").select("id, name").eq("status", "pending");
  (pendingStores ?? []).forEach((s: any) =>
    issues.push({ cls: "warning", icon: "🏪", text: `${s.name} が承認待ちです`, href: "/admin/stores" })
  );

  const { data: openReports } = await supabase.from("reports").select("id, reason").eq("status", "open");
  (openReports ?? []).forEach((r: any) =>
    issues.push({ cls: "critical", icon: "🚨", text: `通報未対応: ${r.reason ?? "理由なし"}`, href: "/admin/reports" })
  );

  const { data: unreadInquiries } = await supabase.from("inquiries").select("id, subject").eq("status", "unread");
  (unreadInquiries ?? []).forEach((i: any) =>
    issues.push({ cls: "warning", icon: "✉️", text: `未読の問い合わせ: ${i.subject || "（件名なし）"}`, href: "/admin/inquiries" })
  );

  const { data: pendingApps } = await supabase
    .from("listing_applications")
    .select("id, company_name")
    .in("status", ["pending", "unconfirmed"]);
  (pendingApps ?? []).forEach((a: any) =>
    issues.push({ cls: "warning", icon: "📝", text: `掲載申込が未審査: ${a.company_name}`, href: "/admin/listing-applications" })
  );

  const { data: approvedApps } = await supabase
    .from("listing_applications")
    .select("id, company_name, store_id")
    .eq("status", "approved");
  const storeIds = (approvedApps ?? []).map((a: any) => a.store_id).filter(Boolean);
  const { data: linkedStores } =
    storeIds.length > 0
      ? await supabase.from("stores").select("id, address, hours").in("id", storeIds)
      : { data: [] as any[] };
  const storeMap = new Map((linkedStores ?? []).map((s: any) => [s.id, s]));
  (approvedApps ?? []).forEach((a: any) => {
    const s = a.store_id ? storeMap.get(a.store_id) : null;
    if (!s || !s.address || !s.hours) {
      issues.push({
        cls: "warning",
        icon: "🏗️",
        text: `${a.company_name} の店舗情報が未完成です(住所・営業時間などを入力してください)`,
        href: "/admin/stores",
      });
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, title, valid_until")
    .eq("active", true)
    .not("valid_until", "is", null);
  (coupons ?? []).forEach((c: any) => {
    if (c.valid_until < today) {
      issues.push({ cls: "outline", icon: "🎟️", text: `クーポン「${c.title}」の有効期限が切れています`, href: "/admin/coupons" });
    } else if (c.valid_until <= in7.toISOString().slice(0, 10)) {
      issues.push({ cls: "warning", icon: "🎟️", text: `クーポン「${c.title}」が近日中に終了します`, href: "/admin/coupons" });
    }
  });

  return issues;
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: SP }) {
  const supabase = await createClient();
  const tab = searchParams.tab ?? "overview";
  const scope = searchParams.scope ?? "all";
  const period = searchParams.period ?? "30";
  const filters = { period, from: searchParams.from, to: searchParams.to };
  const since = analyticsSince(filters);

  const { data: approvedStores } = await supabase
    .from("stores")
    .select("id, name")
    .in("status", ["approved", "listed"])
    .order("name", { ascending: true });

  const issues = await computeIssues(supabase);
  const issueCount = issues.filter((i) => i.cls === "critical" || i.cls === "warning").length;

  const tabs: { key: string; label: string }[] = [
    { key: "overview", label: "全体アクセス" },
    { key: "category", label: "カテゴリー" },
    { key: "banner", label: "バナー効果" },
    { key: "issues", label: "異常・要対応" },
  ];

  return (
    <div>
      <div className="app-topbar" style={{ marginBottom: 10 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>アクセス分析</h1>
        <span className="muted" style={{ fontSize: 12.5 }}>
          サイト全体の閲覧動向（実データ集計・{analyticsPeriodLabel(filters)}）
        </span>
      </div>

      <div className="card" style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>集計対象</span>
          <div style={{ display: "inline-flex", border: "1px solid var(--border-strong)", borderRadius: 8, overflow: "hidden" }}>
            <Link href={hrefWith(searchParams, { scope: "all", storeId: undefined })} className={`btn ${scope !== "store" ? "primary" : ""}`} style={{ borderRadius: 0, fontSize: 12.5 }}>
              全店舗
            </Link>
            <Link href={hrefWith(searchParams, { scope: "store", storeId: searchParams.storeId || approvedStores?.[0]?.id })} className={`btn ${scope === "store" ? "primary" : ""}`} style={{ borderRadius: 0, fontSize: 12.5 }}>
              店舗別
            </Link>
          </div>
          {scope === "store" && (
            <form method="get" style={{ display: "flex", gap: 8 }}>
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="scope" value="store" />
              <input type="hidden" name="period" value={period} />
              <select name="storeId" defaultValue={searchParams.storeId ?? approvedStores?.[0]?.id} style={{ maxWidth: 220 }}>
                {approvedStores?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                表示
              </button>
            </form>
          )}
        </div>
        {scope === "store" && (
          <Link
            href={hrefWith(searchParams, { compare: searchParams.compare === "1" ? undefined : "1" })}
            className={`btn ${searchParams.compare === "1" ? "primary" : ""}`}
            style={{ fontSize: 12.5 }}
          >
            他店舗と比較
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          ["7", "過去7日"],
          ["30", "過去30日"],
          ["90", "過去90日"],
          ["custom", "期間指定"],
        ].map(([k, label]) => (
          <Link key={k} href={hrefWith(searchParams, { period: k })} className={`btn ${period === k ? "primary" : ""}`} style={{ fontSize: 12.5 }}>
            {label}
          </Link>
        ))}
        {period === "custom" && (
          <form method="get" style={{ display: "flex", gap: 6 }}>
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="period" value="custom" />
            <input type="date" name="from" defaultValue={searchParams.from} style={{ maxWidth: 150 }} />
            <span className="muted" style={{ alignSelf: "center" }}>〜</span>
            <input type="date" name="to" defaultValue={searchParams.to} style={{ maxWidth: 150 }} />
            <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
              適用
            </button>
          </form>
        )}
      </div>

      <div className="tabs" style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={hrefWith(searchParams, { tab: t.key })}
            className={`btn ${tab === t.key ? "primary" : ""}`}
            style={{ fontSize: 13 }}
          >
            {t.label}
            {t.key === "issues" && issueCount > 0 && (
              <span
                style={{
                  background: "var(--critical)",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 800,
                  marginLeft: 6,
                }}
              >
                {issueCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === "category" && (
        <CategoryTab supabase={supabase} since={since} scope={scope} storeId={searchParams.storeId} />
      )}
      {tab === "banner" && <BannerTab supabase={supabase} since={since} />}
      {tab === "issues" && <IssuesTab issues={issues} />}
      {(tab === "overview" || !tab) && (
        <OverviewTab
          supabase={supabase}
          filters={filters}
          since={since}
          scope={scope}
          storeId={searchParams.storeId}
          compare={searchParams.compare === "1"}
          approvedStores={approvedStores ?? []}
          q={searchParams.q ?? ""}
          category={searchParams.category ?? ""}
          sort={searchParams.sort ?? "views"}
          searchParams={searchParams}
        />
      )}
    </div>
  );
}

async function OverviewTab({
  supabase,
  filters,
  since,
  scope,
  storeId,
  compare,
  approvedStores,
  q,
  category,
  sort,
  searchParams,
}: any) {
  // Store-scoped drill-down
  if (scope === "store" && storeId) {
    const { data: store } = await supabase.from("stores").select("id, name, category, pref").eq("id", storeId).maybeSingle();
    if (!store) return <p className="empty">店舗が見つかりません。</p>;

    const { data: views } = await supabase
      .from("page_views")
      .select("created_at, referrer, device")
      .eq("store_id", storeId)
      .gte("created_at", since.toISOString());
    const { count: favCount } = await supabase
      .from("favorite_stores")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId);

    const { counts, labels } = bucketTrend((views ?? []).map((v: any) => v.created_at), filters);
    const totalViews = (views ?? []).length;

    const refCounts = new Map<string, number>();
    (views ?? []).forEach((v: any) => {
      const bucket = classifyReferrer(v.referrer);
      refCounts.set(bucket, (refCounts.get(bucket) ?? 0) + 1);
    });
    const refTotal = Math.max(1, (views ?? []).length);
    const referrers = Array.from(refCounts.entries()).map(([label, value]) => ({
      label,
      pct: Math.round((value / refTotal) * 100),
    }));

    const devCounts = { mobile: 0, pc: 0, tablet: 0 };
    (views ?? []).forEach((v: any) => {
      const d = (v.device as "mobile" | "pc" | "tablet") ?? "pc";
      devCounts[d]++;
    });
    const devTotal = Math.max(1, (views ?? []).length);

    let avgPeerViews = 0;
    let diffPct = 0;
    if (compare) {
      const { count: allViews } = await supabase
        .from("page_views")
        .select("*", { count: "exact", head: true })
        .not("store_id", "is", null)
        .gte("created_at", since.toISOString());
      const approvedCount = approvedStores.length || 1;
      avgPeerViews = Math.round((allViews ?? 0) / approvedCount);
      diffPct = avgPeerViews ? Math.round(((totalViews - avgPeerViews) / avgPeerViews) * 100) : 0;
    }

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{store.name} の分析</h3>
          <span className="badge outline">{CATEGORY_LABEL[store.category ?? ""] ?? store.category}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12, marginBottom: 22 }}>
          <StatTile label="期間内PV" value={totalViews.toLocaleString()} delta={trendGranularityLabel(filters)} />
          <StatTile label="累計お気に入り" value={(favCount ?? 0).toLocaleString()} delta={store.pref} />
        </div>
        {compare && (
          <div className="card" style={{ marginBottom: 18 }}>
            <h3>他店舗と比較</h3>
            <p style={{ fontSize: 13 }}>
              全店舗平均PV(同期間): <strong className="tabular">{avgPeerViews.toLocaleString()}</strong>　この店舗は平均より{" "}
              <strong style={{ color: diffPct >= 0 ? "var(--good)" : "var(--critical)" }}>
                {diffPct >= 0 ? "+" : ""}
                {diffPct}%
              </strong>{" "}
              {diffPct >= 0 ? "多い" : "少ない"}です。
            </p>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14 }}>
          <div className="card">
            <h3>閲覧数の推移（{trendGranularityLabel(filters)}）</h3>
            <Sparkline counts={counts} labels={labels} />
          </div>
          <div className="card">
            <h3>流入経路</h3>
            {referrers.length === 0 && <p className="muted small">まだデータがありません。</p>}
            {referrers.map((r) => (
              <Bar key={r.label} label={r.label} value={r.pct} max={100} color="var(--accent, #3987e5)" />
            ))}
            <div className="muted small" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              デバイス比率: 📱モバイル {Math.round((devCounts.mobile / devTotal) * 100)}%　💻PC {Math.round((devCounts.pc / devTotal) * 100)}%　📱タブレット {Math.round((devCounts.tablet / devTotal) * 100)}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Site-wide overview
  const { data: allViews } = await supabase
    .from("page_views")
    .select("created_at, referrer, device, store_id")
    .not("store_id", "is", null)
    .gte("created_at", since.toISOString());
  const { count: totalFavorites } = await supabase.from("favorite_stores").select("*", { count: "exact", head: true });
  const { count: totalStoreCount } = await supabase.from("stores").select("*", { count: "exact", head: true });

  const { counts, labels } = bucketTrend((allViews ?? []).map((v: any) => v.created_at), filters);
  const totalViews = (allViews ?? []).length;

  const viewsByStore = new Map<string, number>();
  (allViews ?? []).forEach((v: any) => {
    viewsByStore.set(v.store_id, (viewsByStore.get(v.store_id) ?? 0) + 1);
  });

  const { data: allStoresFull } = await supabase
    .from("stores")
    .select("id, name, category, pref, status")
    .order("name", { ascending: true });

  const { data: favByStoreRaw } = await supabase.from("favorite_stores").select("store_id");
  const favByStore = new Map<string, number>();
  (favByStoreRaw ?? []).forEach((f: any) => favByStore.set(f.store_id, (favByStore.get(f.store_id) ?? 0) + 1));

  const topStores = [...(allStoresFull ?? [])]
    .map((s: any) => ({ s, periodViews: viewsByStore.get(s.id) ?? 0 }))
    .sort((a, b) => b.periodViews - a.periodViews)
    .slice(0, 5);

  let storeRows = (allStoresFull ?? []).map((s: any) => ({ s, views: viewsByStore.get(s.id) ?? 0, favs: favByStore.get(s.id) ?? 0 }));
  if (q) storeRows = storeRows.filter((r: any) => r.s.name.includes(q));
  if (category) storeRows = storeRows.filter((r: any) => r.s.category === category);
  storeRows.sort((a: any, b: any) => {
    if (sort === "name") return a.s.name.localeCompare(b.s.name, "ja");
    if (sort === "likes") return b.favs - a.favs;
    return b.views - a.views;
  });

  const refCounts = new Map<string, number>();
  (allViews ?? []).forEach((v: any) => {
    const bucket = classifyReferrer(v.referrer);
    refCounts.set(bucket, (refCounts.get(bucket) ?? 0) + 1);
  });
  const refTotal = Math.max(1, (allViews ?? []).length);
  const referrers = Array.from(refCounts.entries()).map(([label, value]) => ({
    label,
    pct: Math.round((value / refTotal) * 100),
  }));

  const devCounts = { mobile: 0, pc: 0, tablet: 0 };
  (allViews ?? []).forEach((v: any) => {
    const d = (v.device as "mobile" | "pc" | "tablet") ?? "pc";
    devCounts[d]++;
  });
  const devTotal = Math.max(1, (allViews ?? []).length);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12, marginBottom: 22 }}>
        <StatTile label="期間内PV" value={totalViews.toLocaleString()} delta={trendGranularityLabel(filters)} />
        <StatTile label="累計お気に入り" value={(totalFavorites ?? 0).toLocaleString()} delta={`全${totalStoreCount ?? 0}店舗`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14 }}>
        <div className="card">
          <h3>閲覧数の推移（全店舗合計・{trendGranularityLabel(filters)}）</h3>
          <Sparkline counts={counts} labels={labels} />
        </div>
        <div className="card">
          <h3>人気店舗ランキング（閲覧数）</h3>
          {topStores.length === 0 && <p className="muted small">データがありません。</p>}
          {topStores.map((t: any, i: number) => (
            <div key={t.s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: i === 0 ? "var(--accent, #3987e5)" : "var(--border)",
                    color: i === 0 ? "#fff" : "var(--muted)",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {i + 1}
                </span>
                <span>{t.s.name}</span>
                <span className="badge outline">{CATEGORY_LABEL[t.s.category ?? ""] ?? t.s.category}</span>
              </div>
              <span className="tabular muted small">{t.periodViews.toLocaleString()} PV</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>流入経路</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 16 }}>
          <div>
            {referrers.length === 0 && <p className="muted small">まだデータがありません。</p>}
            {referrers.map((r) => (
              <Bar key={r.label} label={r.label} value={r.pct} max={100} color="var(--accent, #3987e5)" />
            ))}
          </div>
          <div className="muted small">
            デバイス比率: 📱モバイル {Math.round((devCounts.mobile / devTotal) * 100)}%　💻PC {Math.round((devCounts.pc / devTotal) * 100)}%　📱タブレット {Math.round((devCounts.tablet / devTotal) * 100)}%
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>店舗別アクセス状況（全{allStoresFull?.length ?? 0}店舗）</h3>
        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <input type="hidden" name="tab" value="overview" />
          <input type="hidden" name="period" value={filters.period} />
          <input type="text" name="q" defaultValue={q} placeholder="店舗名で検索" style={{ maxWidth: 220 }} />
          <select name="category" defaultValue={category}>
            <option value="">カテゴリ: すべて</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sort}>
            <option value="views">並び替え: 閲覧数順</option>
            <option value="likes">並び替え: お気に入り順</option>
            <option value="name">並び替え: 店舗名順</option>
          </select>
          <button type="submit" className="btn">
            絞り込む
          </button>
        </form>
        <table>
          <thead>
            <tr>
              <th>店舗名</th>
              <th>都道府県</th>
              <th>ステータス</th>
              <th>期間内PV</th>
              <th>お気に入り</th>
            </tr>
          </thead>
          <tbody>
            {storeRows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">該当する店舗がありません。</td>
              </tr>
            )}
            {storeRows.map(({ s, views, favs }: any) => (
              <tr key={s.id}>
                <td>
                  <span className="badge outline" style={{ marginRight: 6 }}>
                    {CATEGORY_LABEL[s.category ?? ""] ?? s.category}
                  </span>
                  {s.name}
                </td>
                <td>{s.pref}</td>
                <td>
                  <span className="badge">{s.status === "approved" || s.status === "listed" ? "公開中" : s.status}</span>
                </td>
                <td className="tabular">{views.toLocaleString()}</td>
                <td className="tabular">{favs.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function CategoryTab({ supabase, since, scope, storeId }: any) {
  let storesQuery = supabase.from("stores").select("id, name, category");
  if (scope === "store" && storeId) storesQuery = storesQuery.eq("id", storeId);
  const { data: stores } = await storesQuery;

  const storeIds = (stores ?? []).map((s: any) => s.id);
  const { data: views } =
    storeIds.length > 0
      ? await supabase.from("page_views").select("store_id, created_at").in("store_id", storeIds).gte("created_at", since.toISOString())
      : { data: [] as any[] };
  const viewsByStore = new Map<string, number>();
  (views ?? []).forEach((v: any) => viewsByStore.set(v.store_id, (viewsByStore.get(v.store_id) ?? 0) + 1));

  const { data: favs } =
    storeIds.length > 0
      ? await supabase.from("favorite_stores").select("store_id").in("store_id", storeIds)
      : { data: [] as any[] };
  const favByStore = new Map<string, number>();
  (favs ?? []).forEach((f: any) => favByStore.set(f.store_id, (favByStore.get(f.store_id) ?? 0) + 1));

  const rows = CATEGORY_OPTIONS.map((c) => {
    const inCat = (stores ?? []).filter((s: any) => s.category === c.value);
    const views = inCat.reduce((a: number, s: any) => a + (viewsByStore.get(s.id) ?? 0), 0);
    const likes = inCat.reduce((a: number, s: any) => a + (favByStore.get(s.id) ?? 0), 0);
    return { label: c.label, count: inCat.length, views, likes };
  }).sort((a, b) => b.views - a.views);

  const max = Math.max(1, ...rows.map((r) => r.views));

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>カテゴリ別 閲覧数</h3>
        {rows.map((r) => (
          <Bar key={r.label} label={r.label} value={r.views} max={max} color="var(--accent, #3987e5)" />
        ))}
      </div>
      <div className="card">
        <h3>カテゴリ別サマリー</h3>
        <table>
          <thead>
            <tr>
              <th>カテゴリ</th>
              <th>店舗数</th>
              <th>累計PV</th>
              <th>累計お気に入り</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="tabular">{r.count}</td>
                <td className="tabular">{r.views.toLocaleString()}</td>
                <td className="tabular">{r.likes.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function BannerTab({ supabase, since }: any) {
  const { data: banners } = await supabase.from("banners").select("*").order("sort_order", { ascending: true });
  const bannerIds = (banners ?? []).map((b: any) => b.id);

  const [{ data: impressions }, { data: clicks }] = await Promise.all([
    bannerIds.length > 0
      ? supabase.from("banner_impressions").select("banner_id").in("banner_id", bannerIds).gte("created_at", since.toISOString())
      : Promise.resolve({ data: [] as any[] }),
    bannerIds.length > 0
      ? supabase.from("banner_clicks").select("banner_id").in("banner_id", bannerIds).gte("created_at", since.toISOString())
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const imprCounts = new Map<string, number>();
  (impressions ?? []).forEach((i: any) => imprCounts.set(i.banner_id, (imprCounts.get(i.banner_id) ?? 0) + 1));
  const clickCounts = new Map<string, number>();
  (clicks ?? []).forEach((c: any) => clickCounts.set(c.banner_id, (clickCounts.get(c.banner_id) ?? 0) + 1));

  const scaled = (banners ?? []).map((b: any) => ({
    ...b,
    impressions: imprCounts.get(b.id) ?? 0,
    clicks: clickCounts.get(b.id) ?? 0,
  }));
  const totalImpr = scaled.reduce((a: number, b: any) => a + b.impressions, 0);
  const totalClicks = scaled.reduce((a: number, b: any) => a + b.clicks, 0);
  const avgCtr = totalImpr ? ((totalClicks / totalImpr) * 100).toFixed(2) : "0.00";
  const max = Math.max(1, ...scaled.map((b: any) => b.clicks));

  const POSITION_LABEL: Record<string, string> = {
    top: "トップ",
    sidebar: "サイドバー",
    footer: "フッター",
    store_list: "店舗一覧",
    job_list: "求人一覧",
    job_detail: "求人詳細",
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12, marginBottom: 18 }}>
        <StatTile label="総表示回数" value={totalImpr.toLocaleString()} />
        <StatTile label="総クリック数" value={totalClicks.toLocaleString()} />
        <StatTile label="平均CTR" value={`${avgCtr}%`} />
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>バナー別クリック数</h3>
        {scaled.length === 0 && <p className="muted small">バナーがありません。</p>}
        {scaled.map((b: any) => (
          <Bar key={b.id} label={b.title} value={b.clicks} max={max} color="var(--accent, #3987e5)" />
        ))}
      </div>
      <div className="card">
        <h3>バナー詳細</h3>
        <table>
          <thead>
            <tr>
              <th>バナー</th>
              <th>掲載位置</th>
              <th>表示回数</th>
              <th>クリック数</th>
              <th>CTR</th>
              <th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {scaled.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">バナーがありません。</td>
              </tr>
            )}
            {scaled.map((b: any) => {
              const ctr = b.impressions ? ((b.clicks / b.impressions) * 100).toFixed(2) : "0.00";
              return (
                <tr key={b.id}>
                  <td>
                    <strong>{b.title}</strong>
                  </td>
                  <td>{POSITION_LABEL[b.position] ?? b.position}</td>
                  <td className="tabular">{b.impressions.toLocaleString()}</td>
                  <td className="tabular">{b.clicks.toLocaleString()}</td>
                  <td className="tabular">{ctr}%</td>
                  <td>
                    <span className={`badge ${b.active ? "good" : "outline"}`}>{b.active ? "✓ 公開中" : "非公開"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          <Link href="/admin/banners" className="btn" style={{ fontSize: 12.5 }}>
            バナー管理を開く →
          </Link>
        </div>
      </div>
    </div>
  );
}

function IssuesTab({ issues }: { issues: AnalyticsIssue[] }) {
  const order: Record<string, number> = { critical: 0, warning: 1, outline: 2 };
  const sorted = [...issues].sort((a, b) => order[a.cls] - order[b.cls]);
  const counts = { critical: 0, warning: 0, outline: 0 };
  sorted.forEach((i) => counts[i.cls]++);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12, marginBottom: 18 }}>
        <StatTile label="重大" value={String(counts.critical)} delta="要対応の通報など" />
        <StatTile label="注意" value={String(counts.warning)} delta="承認待ち・未読など" />
        <StatTile label="参考" value={String(counts.outline)} delta="期限切れなど" />
      </div>
      <div className="card">
        <h3>要対応リスト</h3>
        {sorted.length === 0 && <p className="muted small" style={{ padding: "14px 0" }}>現在、対応が必要な項目はありません。</p>}
        {sorted.map((i, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`badge ${i.cls}`}>{i.icon}</span>
              <span style={{ fontSize: 13 }}>{i.text}</span>
            </div>
            <Link href={i.href} className="btn" style={{ fontSize: 12 }}>
              確認する
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

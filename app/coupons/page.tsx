import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { PREF_OPTIONS, CATEGORY_OPTIONS, CATEGORY_LABEL } from "@/lib/constants";

function couponStatus(c: { valid_until: string | null; usage_limit: number | null; used_count: number | null }) {
  const today = new Date().toISOString().slice(0, 10);
  if (c.valid_until && c.valid_until < today) return "expired";
  if (c.usage_limit != null && (c.used_count ?? 0) >= c.usage_limit) return "exhausted";
  return "active";
}

function statusBadge(status: string) {
  if (status === "expired") return <span className="badge outline">⏳ 期限切れ</span>;
  if (status === "exhausted") return <span className="badge warning">🈵 上限到達</span>;
  return <span className="badge good">✓ 有効</span>;
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: { pref?: string; category?: string };
}) {
  const pref = searchParams.pref ?? "";
  const category = searchParams.category ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawCoupons } = await supabase
    .from("coupons")
    .select(
      "id, title, discount, description, code, valid_until, usage_limit, used_count, store_id, stores(name, category, pref, status)"
    )
    .eq("active", true)
    .order("created_at", { ascending: false });

  let coupons = (rawCoupons ?? []).filter(
    (c: any) => c.stores?.status === "approved" || c.stores?.status === "listed"
  );
  if (pref) coupons = coupons.filter((c: any) => c.stores?.pref === pref);
  if (category) coupons = coupons.filter((c: any) => c.stores?.category === category);

  const active = coupons.filter((c: any) => couponStatus(c) === "active");
  const inactive = coupons.filter((c: any) => couponStatus(c) !== "active");
  const list = [...active, ...inactive];

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>人気のクーポン</h1>

        <form
          method="get"
          style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}
        >
          <select
            name="pref"
            defaultValue={pref}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "1 1 160px",
            }}
          >
            <option value="">都道府県: すべて</option>
            {PREF_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={category}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "1 1 180px",
            }}
          >
            <option value="">カテゴリ: すべて</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn primary" style={{ fontSize: 13 }}>
            検索
          </button>
        </form>

        {list.length === 0 && <div className="empty">条件に合うクーポンが見つかりませんでした。</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {list.map((c: any) => {
            const status = couponStatus(c);
            return (
              <Link href={`/coupons/${c.id}`} key={c.id} style={{ display: "block", opacity: status !== "active" ? 0.62 : 1 }}>
                <div className="card">
                  <div className="meta" style={{ marginBottom: 6 }}>
                    {c.stores?.category && (
                      <span className="badge">{CATEGORY_LABEL[c.stores.category] ?? c.stores.category}</span>
                    )}
                    {status !== "active" && statusBadge(status)}
                  </div>
                  <h3>{c.title}</h3>
                  <div className="muted">{c.stores?.name}</div>
                  {c.discount && <div style={{ fontWeight: 700, color: "var(--accent-text)", marginTop: 4 }}>{c.discount}</div>}
                  {c.valid_until && (
                    <div className="muted" style={{ marginTop: 6 }}>
                      有効期限: {c.valid_until}まで
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
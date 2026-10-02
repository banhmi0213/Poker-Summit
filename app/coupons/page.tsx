import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { PREF_OPTIONS, CATEGORY_LABEL, COUPON_OFFER_TYPE_OPTIONS } from "@/lib/constants";
import { CouponBannerLightbox } from "./coupon-banner-lightbox";

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

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: { q?: string; pref?: string; offerType?: string; sort?: string; onlyAvailable?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const pref = searchParams.pref ?? "";
  const offerType = searchParams.offerType ?? "";
  // 並び替え。既定は「有効期限が近い順」(expiry)、もう一方は「新着順」(new)。
  const sort = searchParams.sort === "new" ? "new" : "expiry";
  const onlyAvailable = searchParams.onlyAvailable === "1";

  function buildHref(
    overrides: {
      q?: string;
      pref?: string;
      offerType?: string;
      sort?: string;
      onlyAvailable?: boolean;
    } = {}
  ) {
    const nextQ = overrides.q !== undefined ? overrides.q : q;
    const nextPref = overrides.pref !== undefined ? overrides.pref : pref;
    const nextOfferType = overrides.offerType !== undefined ? overrides.offerType : offerType;
    const nextSort = overrides.sort !== undefined ? overrides.sort : sort;
    const nextOnlyAvailable =
      overrides.onlyAvailable !== undefined ? overrides.onlyAvailable : onlyAvailable;
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextPref) params.set("pref", nextPref);
    if (nextOfferType) params.set("offerType", nextOfferType);
    if (nextSort && nextSort !== "expiry") params.set("sort", nextSort);
    if (nextOnlyAvailable) params.set("onlyAvailable", "1");
    const qs = params.toString();
    return `/coupons${qs ? `?${qs}` : ""}`;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawCoupons } = await supabase
    .from("coupons")
    .select(
      "id, title, discount, description, code, valid_until, usage_limit, used_count, offer_type, banner_image_url, store_id, created_at, stores(name, category, pref, city, status)"
    )
    .eq("active", true);

  let coupons = (rawCoupons ?? []).filter(
    (c: any) => c.stores?.status === "approved" || c.stores?.status === "listed"
  );
  if (pref) coupons = coupons.filter((c: any) => c.stores?.pref === pref);
  if (offerType) coupons = coupons.filter((c: any) => c.offer_type === offerType);
  if (q) {
    coupons = coupons.filter(
      (c: any) => c.title?.includes(q) || c.stores?.name?.includes(q)
    );
  }

  function sorted(list: any[]) {
    return [...list].sort((a, b) => {
      if (sort === "new") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // 有効期限が近い順。期限なしは末尾へ。
      if (!a.valid_until && !b.valid_until) return 0;
      if (!a.valid_until) return 1;
      if (!b.valid_until) return -1;
      return a.valid_until < b.valid_until ? -1 : a.valid_until > b.valid_until ? 1 : 0;
    });
  }

  const active = coupons.filter((c: any) => couponStatus(c) === "active");
  const inactive = coupons.filter((c: any) => couponStatus(c) !== "active");
  // 「利用可能のみ」チェック時は利用不可(期限切れ・上限到達)のクーポンを
  // 一覧から除外する。チェックなしの場合は従来どおり有効なものを先頭に
  // まとめつつ、利用不可のものもグレーアウト表示のまま一覧の末尾に残す。
  const list = onlyAvailable ? sorted(active) : [...sorted(active), ...sorted(inactive)];

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container">
        <div className="coupon-hero">
          <img
            className="coupon-hero__bg"
            src="/images/poker-region-hero-bg.png"
            alt=""
          />
          <div className="coupon-hero__overlay" />
          <div className="coupon-hero__content">
            <span className="coupon-hero__eyebrow">COUPONS &amp; OFFERS</span>
            <h1 className="coupon-hero__title">クーポンで、もっとポーカーを楽しもう。</h1>
            <p className="coupon-hero__subtitle">気になるお店の特典を、まとめてチェック。</p>
          </div>
        </div>

        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input type="hidden" name="sort" value={sort} />
          {onlyAvailable && <input type="hidden" name="onlyAvailable" value="1" />}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="店名・キーワードで検索"
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "2 1 220px",
            }}
          />
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
            <option value="">エリア: 全国</option>
            {PREF_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            name="offerType"
            defaultValue={offerType}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              fontSize: 13,
              flex: "1 1 160px",
            }}
          >
            <option value="">特典タイプ: すべて</option>
            {COUPON_OFFER_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="submit" className="btn primary" style={{ fontSize: 13 }}>
            検索
          </button>
        </form>

        <div className="chip-row" style={{ marginBottom: 18 }}>
          <Link href={buildHref({ offerType: "" })} className={`chip ${!offerType ? "active" : ""}`}>
            すべて
          </Link>
          {COUPON_OFFER_TYPE_OPTIONS.map((t) => (
            <Link
              key={t}
              href={buildHref({ offerType: t })}
              className={`chip ${offerType === t ? "active" : ""}`}
            >
              {t}
            </Link>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <h2 style={{ fontSize: 17 }}>クーポン一覧　{list.length}件</h2>
          <form method="get" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="pref" value={pref} />
            <input type="hidden" name="offerType" value={offerType} />
            <select
              name="sort"
              defaultValue={sort}
              style={{
                padding: "7px 9px",
                borderRadius: 6,
                border: "1px solid var(--border-strong)",
                background: "var(--surface-2)",
                fontSize: 12.5,
              }}
            >
              <option value="expiry">有効期限が近い順</option>
              <option value="new">新着順</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
              <input type="checkbox" name="onlyAvailable" value="1" defaultChecked={onlyAvailable} />
              利用可能のみ
            </label>
            <button type="submit" className="btn" style={{ fontSize: 12 }}>
              並び替え
            </button>
          </form>
        </div>

        {list.length === 0 && <div className="empty">条件に合うクーポンが見つかりませんでした。</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {list.map((c: any) => {
            const status = couponStatus(c);
            const location = [c.stores?.pref, c.stores?.city].filter(Boolean).join("・");
            return (
              <div className="card coupon-card" key={c.id} style={{ opacity: status !== "active" ? 0.62 : 1 }}>
                <div className="coupon-card__media">
                  {c.banner_image_url ? (
                    <CouponBannerLightbox imageUrl={c.banner_image_url} alt={c.title} />
                  ) : (
                    <span className="coupon-card__media-fallback">🎟️</span>
                  )}
                </div>
                <div className="coupon-card__body">
                  <div className="meta" style={{ marginBottom: 2 }}>
                    {c.stores?.category && (
                      <span className="badge">{CATEGORY_LABEL[c.stores.category] ?? c.stores.category}</span>
                    )}
                    {status !== "active" && statusBadge(status)}
                  </div>
                  <h3>{c.title}</h3>
                  {c.discount && (
                    <div style={{ fontWeight: 700, color: "var(--accent-text)" }}>{c.discount}</div>
                  )}
                  <div className="coupon-card__store">
                    {c.stores?.name}
                    {location && <>　{location}</>}
                  </div>
                  <div className="coupon-card__meta-line">
                    有効期限：{c.valid_until ?? "設定なし"}
                  </div>
                  {c.description && (
                    <div className="coupon-card__meta-line">{truncate(c.description, 28)}</div>
                  )}
                  <div className="coupon-card__cta">
                    <Link href={`/coupons/${c.id}`} className="btn" style={{ width: "100%" }}>
                      条件・詳細を見る ›
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>クーポンの使い方</h2>
          <p className="muted small" style={{ marginBottom: 4 }}>かんたん3ステップで特典を利用できます。</p>
          <div className="coupon-steps">
            <div className="coupon-step">
              <span className="coupon-step__num">1</span>
              <span className="coupon-step__icon">🔍</span>
              <div>
                <div className="coupon-step__title">特典を探す</div>
                <div className="coupon-step__desc">気になるお店のクーポンを見つけましょう</div>
              </div>
            </div>
            <span className="coupon-step__arrow">›</span>
            <div className="coupon-step">
              <span className="coupon-step__num">2</span>
              <span className="coupon-step__icon">📄</span>
              <div>
                <div className="coupon-step__title">利用条件を確認</div>
                <div className="coupon-step__desc">有効期限や対象内容など詳細を確認します。</div>
              </div>
            </div>
            <span className="coupon-step__arrow">›</span>
            <div className="coupon-step">
              <span className="coupon-step__num">3</span>
              <span className="coupon-step__icon">🏪</span>
              <div>
                <div className="coupon-step__title">店頭で提示</div>
                <div className="coupon-step__desc">お店でクーポン画面を提示して特典を受けましょう</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

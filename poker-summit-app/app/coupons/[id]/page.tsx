import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { useCoupon } from "@/app/member-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";

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

export default async function CouponDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: coupon } = await supabase
    .from("coupons")
    .select(
      "id, title, discount, description, code, valid_until, usage_limit, used_count, store_id, stores(id, name, status)"
    )
    .eq("id", params.id)
    .eq("active", true)
    .maybeSingle();

  const c = coupon as any;
  if (!c || !c.stores || !["approved", "listed"].includes(c.stores.status)) {
    notFound();
  }

  const path = `/coupons/${c.id}`;
  const status = couponStatus(c);

  let usedByMe = false;
  if (user) {
    const { data: use } = await supabase
      .from("coupon_uses")
      .select("coupon_id")
      .eq("user_id", user.id)
      .eq("coupon_id", c.id)
      .maybeSingle();
    usedByMe = !!use;
  }

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ maxWidth: 480 }}>
        <Link href="/coupons" className="breadcrumb">
          ← クーポン一覧に戻る
        </Link>
        <div className="card" style={{ textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 40 }}>🎟️</div>
          <h1 style={{ fontSize: 19, margin: "10px 0 2px" }}>{c.title}</h1>
          <p className="muted small">{c.stores?.name}</p>
          <div style={{ marginTop: 6 }}>{statusBadge(status)}</div>
          {c.description && <p style={{ margin: "14px 0" }}>{c.description}</p>}
          {c.discount && (
            <p style={{ fontWeight: 700, color: "var(--accent-text)" }}>{c.discount}</p>
          )}
          {c.code && (
            <div className="badge accent" style={{ fontSize: 14, padding: "8px 16px", marginTop: 10 }}>
              クーポンコード: {c.code}
            </div>
          )}
          <p className="muted small" style={{ marginTop: 10 }}>
            {c.valid_until ? `有効期限: ${c.valid_until}` : "有効期限なし"} ・ 利用済み {c.used_count ?? 0}
            {c.usage_limit != null ? `/${c.usage_limit}` : ""}件
          </p>

          {usedByMe ? (
            <button type="button" className="btn" style={{ marginTop: 16, width: "100%" }} disabled>
              ✓ 使用済みです
            </button>
          ) : status === "expired" ? (
            <button type="button" className="btn" style={{ marginTop: 16, width: "100%" }} disabled>
              有効期限が切れています
            </button>
          ) : status === "exhausted" ? (
            <button type="button" className="btn" style={{ marginTop: 16, width: "100%" }} disabled>
              利用上限に達しました
            </button>
          ) : (
            <form
              action={async () => {
                "use server";
                await useCoupon(c.id, path);
              }}
              style={{ marginTop: 16 }}
            >
              <button type="submit" className="btn primary" style={{ width: "100%" }}>
                このクーポンを使う
              </button>
            </form>
          )}

          <Link href={`/stores/${c.store_id}`} className="btn" style={{ marginTop: 10, display: "inline-flex" }}>
            この店舗のページを見る
          </Link>
        </div>
      </div>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

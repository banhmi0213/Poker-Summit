import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setFavoriteCoupon } from "@/app/coupons/favorite-actions";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { CouponBannerLightbox } from "@/app/coupons/coupon-banner-lightbox";
import styles from "./detail.module.css";

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
      "id, title, discount, description, code, valid_until, usage_limit, used_count, offer_type, banner_image_url, store_id, stores(id, name, status)"
    )
    .eq("id", params.id)
    .eq("active", true)
    .maybeSingle();

  const c = coupon as any;
  if (!c || !c.stores || !["approved", "listed"].includes(c.stores.status)) {
    notFound();
  }

  const status = couponStatus(c);

  let isFavorite = false;
  if (user) {
    const { data: favorite, error } = await supabase.from("favorite_coupons")
      .select("coupon_id").eq("user_id", user.id).eq("coupon_id", c.id).maybeSingle();
    if (error) throw new Error("お気に入りを読み込めませんでした。");
    isFavorite = !!favorite;
  }

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <main className={`container ${styles.page}`}>
        <nav className={styles.breadcrumb} aria-label="パンくず">
          <Link href="/">TOP</Link><span>›</span><Link href="/coupons">クーポン一覧</Link><span>›</span><span>{c.title}</span>
        </nav>
        <section className={styles.panel}>
          <div className={styles.visual}>
            <div className={styles.banner}>
              {c.banner_image_url ? <CouponBannerLightbox imageUrl={c.banner_image_url} alt={c.title} /> : <div className={styles.placeholder}><span>POKER SUMMIT</span><strong>{c.title}</strong><small>COUPON & OFFERS</small></div>}
            </div>
            <div className={styles.store}>
              <div><small>このクーポンが使える店舗</small><strong>{c.stores.name}</strong></div>
              <Link href={`/stores/${c.store_id}`} className="btn">店舗ページを見る ›</Link>
            </div>
          </div>
          <div className={styles.info}>
            <div className={styles.badges}>{c.offer_type && <span className="badge outline">{c.offer_type}</span>}{statusBadge(status)}</div>
            <h1>{c.title}</h1>
            {c.discount && <p className={styles.discount}>{c.discount}</p>}
            <p className={styles.expiry}>▣ {c.valid_until ? `有効期限：${c.valid_until.replaceAll("-", ".")}` : "有効期限なし"}</p>
            <p className={styles.note}>特典の内容・利用条件をご確認のうえ、ご利用ください。</p>
            <section className={styles.conditions}>
              <h2>ご利用条件</h2>
              {c.description ? <p className={styles.description}>{c.description}</p> : <p className={styles.description}>詳しい利用条件は店舗へお問い合わせください。</p>}
              <dl><div><dt>利用回数</dt><dd>お一人様1回</dd></div><div><dt>利用状況</dt><dd>{c.used_count ?? 0}件利用済み{c.usage_limit != null ? ` ／ 全体の上限${c.usage_limit}件` : ""}</dd></div></dl>
            </section>
            {c.code && <div className={styles.code}>クーポンコード <strong>{c.code}</strong></div>}
            <div className={styles.present}><span aria-hidden="true">▤</span><div><h2>店頭でこの画面をご提示ください。</h2><p>利用条件をご確認のうえ、お店でクーポン画面を提示して特典をお受け取りください。</p></div></div>
            <form action={async () => {
              "use server";
              await setFavoriteCoupon(c.id, !isFavorite);
            }} className={styles.favoriteForm}>
              <button type="submit" className={styles.favoriteButton} aria-pressed={isFavorite}>
                <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span> {isFavorite ? "お気に入り保存済み・解除" : "お気に入りに保存"}
              </button>
            </form>
          </div>
        </section>
        <section className={styles.how}>
          <h2>クーポンの使い方</h2>
          <p>かんたん3ステップで特典を利用できます。</p>
          <ol>
            <li><span>1</span><div><h3>特典を探す</h3><p>お気に入りのお店のクーポンを見つけましょう。</p></div></li>
            <li><span>2</span><div><h3>利用条件を確認</h3><p>有効期限や対象内容など、詳細をご確認ください。</p></div></li>
            <li><span>3</span><div><h3>店頭で提示</h3><p>お店で画面を提示し、スタッフの案内に従ってご利用ください。</p></div></li>
          </ol>
        </section>
        <Link href="/coupons" className={styles.back}>← クーポン一覧に戻る</Link>
      </main>
      <PortalFooter />
      <BottomTabs />
    </div>
  );
}

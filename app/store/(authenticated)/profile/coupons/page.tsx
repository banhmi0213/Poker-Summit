import { couponCategoryLabel } from "@/lib/coupon-categories";
import { ReadableName } from "@/app/readable-name";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createCoupon, deactivateCoupon, updateCoupon, deleteCoupon } from "../coupons-actions";
import { CouponCategorySelect } from "@/app/coupon-category-select";
import { StoreContentRuleNotice } from "../content-rule-notice";
import { ConfirmButton } from "../confirm-button";
import s from "../manage.module.css";

// /store/profile 1ページの中の1セクションだったクーポン管理を、独立した
// ページへ分離(2026/09/30)。バナー画像はファイルアップロード対応
// (2026/09/30)。
export default async function StoreCouponsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/coupons");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!store) {
    return (
      <div className="container">
        <p className="err">このアカウントに紐づく店舗が見つかりません。運営に店舗オーナーとしての登録を依頼してください。</p>
      </div>
    );
  }

  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const couponList = coupons ?? [];
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const couponFields = (c?: (typeof couponList)[number]) => (
    <>
      <div className="field">
        <span>クーポンタイトル</span>
        <input type="text" name="title" required defaultValue={c?.title ?? ""} placeholder="例: 初回来店ドリンク1杯無料" />
      </div>
      <div className="field">
        <span>割引内容</span>
        <input type="text" name="discount" defaultValue={c?.discount ?? ""} placeholder="例: 500円引き" />
      </div>
      <div className="field">
        <span>説明</span>
        <textarea name="description" rows={4} defaultValue={c?.description ?? ""} />
      </div>
      <CouponCategorySelect value={c?.offer_type ?? ""} />
      <div className="field">
        <span>クーポンコード</span>
        <input type="text" name="code" defaultValue={c?.code ?? ""} />
      </div>
      <div className="field">
        <span>有効期限</span>
        <input type="date" name="validUntil" defaultValue={c?.valid_until ?? ""} />
      </div>
      <div className="field">
        <span>利用上限件数（空欄で無制限）</span>
        <input type="number" name="usageLimit" min={1} inputMode="numeric" defaultValue={c?.usage_limit ?? ""} />
      </div>
      <div className="field">
        <span>{c ? "バナー画像を差し替える（任意）" : "バナー画像（任意）"}</span>
        <input type="file" name="bannerImage" accept="image/*" capture="environment" />
      </div>
      {c?.banner_image_url && (
        <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 8, margin: "-4px 0 14px", fontSize: 14 }}>
          <input type="checkbox" name="removeBanner" />
          現在のバナー画像を削除する
        </label>
      )}
    </>
  );

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>クーポン管理</h1>
      <StoreContentRuleNotice />

      <details className={`card ${s.add}`} open={couponList.length === 0}>
        <summary>
          <span className={s.plus} aria-hidden>＋</span>新しいクーポンを発行する
        </summary>
        <div className={s.addBody}>
          <form action={createCoupon} encType="multipart/form-data">
            <input type="hidden" name="storeId" value={store.id} />
            {couponFields()}
            <button type="submit" className="btn primary">
              クーポンを発行する
            </button>
          </form>
        </div>
      </details>

      {couponList.length > 0 && (
        <div className={s.listHead}>
          <h2>発行したクーポン</h2>
          <span>{couponList.length}件</span>
        </div>
      )}

      {couponList.map((c) => {
        const expired = !!c.valid_until && c.valid_until < today;
        return (
          <div className={`card ${s.item} ${c.active && !expired ? "" : s.closed}`} key={c.id}>
            <h3 className={s.itemTitle}><ReadableName name={c.title} /></h3>
            <div className={s.badges}>
              <span className={`badge ${c.active ? s.badgeOn : s.badgeOff}`}>{c.active ? "公開中" : "停止中"}</span>
              {expired && <span className={`badge ${s.badgeOff}`}>期限切れ</span>}
              {c.offer_type ? <span className="badge outline">{couponCategoryLabel(c.offer_type)}</span> : <span className={`badge ${s.badgeWarn}`}>カテゴリ未設定</span>}
            </div>
            {c.banner_image_url && <img className={s.thumb} src={c.banner_image_url} alt="" loading="lazy" />}
            <div className={s.facts}>
              {c.discount && <span>{c.discount}</span>}
              <span className={s.sub}>
                有効期限 {c.valid_until ? c.valid_until.replaceAll("-", "/") : "なし"} ・ 利用 {c.used_count ?? 0}
                {c.usage_limit != null ? `/${c.usage_limit}` : ""}件
              </span>
            </div>
            {!c.offer_type && <p className={s.warn}>掲載カテゴリが未設定です。「内容を編集する」から選ぶと、カテゴリ別の一覧にも掲載されます。</p>}
            <div className={s.actions}>
              {c.active && (
                <form
                  action={async () => {
                    "use server";
                    await deactivateCoupon(c.id, store.id);
                  }}
                >
                  <button type="submit" className="btn">
                    公開を停止する
                  </button>
                </form>
              )}
              <form
                action={async () => {
                  "use server";
                  await deleteCoupon(c.id, store.id);
                }}
              >
                <ConfirmButton className={`btn ${s.danger}`} message={`「${c.title}」を削除しますか？この操作は取り消せません。`}>
                  削除する
                </ConfirmButton>
              </form>
            </div>
            <details className={s.more}>
              <summary>内容を編集する</summary>
              <div className={s.moreBody}>
                <form action={updateCoupon} encType="multipart/form-data" className={s.editForm}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="couponId" value={c.id} />
                  {couponFields(c)}
                  <button type="submit" className="btn primary">
                    更新する
                  </button>
                </form>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}

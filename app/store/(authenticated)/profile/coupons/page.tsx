import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { createCoupon, deactivateCoupon, updateCoupon, deleteCoupon } from "../coupons-actions";

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

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>クーポン管理</h1>

      <div className="card">
        <form action={createCoupon} encType="multipart/form-data">
          <input type="hidden" name="storeId" value={store.id} />
          <div className="field">
            <span className="muted">クーポンタイトル</span>
            <input type="text" name="title" required />
          </div>
          <div className="field">
            <span className="muted">割引内容</span>
            <input type="text" name="discount" placeholder="例: 500円引き" />
          </div>
          <div className="field">
            <span className="muted">説明</span>
            <textarea name="description" rows={3} />
          </div>
          <div className="field">
            <span className="muted">クーポンコード</span>
            <input type="text" name="code" />
          </div>
          <div className="field">
            <span className="muted">有効期限</span>
            <input type="date" name="validUntil" />
          </div>
          <div className="field">
            <span className="muted">利用上限件数（空欄で無制限）</span>
            <input type="number" name="usageLimit" min={1} />
          </div>
          <div className="field">
            <span className="muted">バナー画像（任意）</span>
            <input type="file" name="bannerImage" accept="image/*" capture="environment" />
          </div>
          <button type="submit" className="btn primary">
            クーポンを発行する
          </button>
        </form>
      </div>

      {coupons?.map((c) => (
        <div className="card" key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <h3>{c.title}</h3>
            <span className="badge">{c.active ? "公開中" : "停止中"}</span>
          </div>
          {c.banner_image_url && (
            <img
              src={c.banner_image_url}
              alt=""
              style={{ width: "100%", maxWidth: 320, borderRadius: 8, marginTop: 8, objectFit: "cover" }}
            />
          )}
          {c.discount && <p className="muted">{c.discount}</p>}
          <p className="muted small" style={{ marginTop: 4 }}>
            有効期限: {c.valid_until ?? "なし"} ・ 利用 {c.used_count ?? 0}
            {c.usage_limit != null ? `/${c.usage_limit}` : ""}件
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {c.active && (
              <form
                action={async () => {
                  "use server";
                  await deactivateCoupon(c.id, store.id);
                }}
              >
                <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
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
              <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
                削除
              </button>
            </form>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="muted small" style={{ cursor: "pointer" }}>
              編集
            </summary>
            <form action={updateCoupon} encType="multipart/form-data" style={{ marginTop: 10 }}>
              <input type="hidden" name="storeId" value={store.id} />
              <input type="hidden" name="couponId" value={c.id} />
              <div className="field">
                <span className="muted">クーポンタイトル</span>
                <input type="text" name="title" required defaultValue={c.title} />
              </div>
              <div className="field">
                <span className="muted">割引内容</span>
                <input type="text" name="discount" defaultValue={c.discount ?? ""} />
              </div>
              <div className="field">
                <span className="muted">説明</span>
                <textarea name="description" rows={3} defaultValue={c.description ?? ""} />
              </div>
              <div className="field">
                <span className="muted">クーポンコード</span>
                <input type="text" name="code" defaultValue={c.code ?? ""} />
              </div>
              <div className="field">
                <span className="muted">有効期限</span>
                <input type="date" name="validUntil" defaultValue={c.valid_until ?? ""} />
              </div>
              <div className="field">
                <span className="muted">利用上限件数（空欄で無制限）</span>
                <input type="number" name="usageLimit" min={1} defaultValue={c.usage_limit ?? ""} />
              </div>
              <div className="field">
                <span className="muted">バナー画像を差し替える（任意）</span>
                <input type="file" name="bannerImage" accept="image/*" capture="environment" />
              </div>
              {c.banner_image_url && (
                <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <input type="checkbox" name="removeBanner" />
                  現在のバナー画像を削除する
                </label>
              )}
              <button type="submit" className="btn primary" style={{ fontSize: 12.5, marginTop: 10 }}>
                更新する
              </button>
            </form>
          </details>
        </div>
      ))}
    </div>
  );
}

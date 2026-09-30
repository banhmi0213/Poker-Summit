import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCouponByAdmin } from "../../actions";

// 従来は /admin/coupons の一覧テーブル内(操作列、幅の狭いセル)に<details>で
// インライン展開していたが、店舗管理・求人管理・イベント管理と同じ理由
// (2026/09/30)で使いにくいとの指摘を受け、独立した編集ページに分離した。
// (app/admin/stores/[id]/edit と同じパターン)
export default async function AdminCouponEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: coupon } = await supabase
    .from("coupons")
    .select(
      "id, title, discount, description, code, valid_until, usage_limit, used_count, active, store_id, stores(name)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!coupon) {
    notFound();
  }

  const storeName = (coupon.stores as unknown as { name: string } | null)?.name ?? "店舗未設定";

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{coupon.title} を編集</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            <span className="badge outline" style={{ marginRight: 6 }}>
              {storeName}
            </span>
            <span className="badge">{coupon.active ? "公開中" : "停止中"}</span>
          </div>
        </div>
        <Link href="/admin/coupons" className="btn">
          ← クーポン一覧へ戻る
        </Link>
      </div>

      <div className="card">
        <form
          action={updateCouponByAdmin}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          <input type="hidden" name="couponId" value={coupon.id} />

          <div className="field">
            <span className="muted">タイトル *</span>
            <input type="text" name="title" defaultValue={coupon.title} required />
          </div>

          <div className="field">
            <span className="muted">割引内容</span>
            <input type="text" name="discount" defaultValue={coupon.discount ?? ""} placeholder="例: 20%OFF" />
          </div>

          <div className="field">
            <span className="muted">クーポンコード</span>
            <input type="text" name="code" defaultValue={coupon.code ?? ""} />
          </div>

          <div className="field">
            <span className="muted">有効期限</span>
            <input type="date" name="validUntil" defaultValue={coupon.valid_until ?? ""} />
          </div>

          <div className="field">
            <span className="muted">利用可能回数（空欄で無制限）</span>
            <input type="number" name="usageLimit" min={1} defaultValue={coupon.usage_limit ?? ""} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="muted">説明</span>
            <textarea name="description" rows={4} defaultValue={coupon.description ?? ""} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" className="btn primary">
              保存する
            </button>
            <Link href="/admin/coupons" className="btn">
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

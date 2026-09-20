import { createClient } from "@/lib/supabase/server";
import { setCouponActive, deleteCoupon, createCouponByAdmin, updateCouponByAdmin } from "./actions";

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q ?? "";
  const status = searchParams.status ?? "all";

  const { data: allStores } = await supabase
    .from("stores")
    .select("id, name")
    .order("name", { ascending: true });

  let query = supabase
    .from("coupons")
    .select("id, title, discount, code, valid_until, usage_limit, used_count, active, store_id, stores(name)")
    .order("created_at", { ascending: false });

  if (status === "active") {
    query = query.eq("active", true);
  } else if (status === "inactive") {
    query = query.eq("active", false);
  }
  if (q) {
    const matchingStoreIds = (allStores ?? [])
      .filter((s) => s.name.includes(q))
      .map((s) => s.id);
    const orParts = [`title.ilike.%${q}%`];
    if (matchingStoreIds.length > 0) {
      orParts.push(`store_id.in.(${matchingStoreIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data: coupons } = await query;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>クーポン管理（全店舗）</h1>

      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>＋ クーポンを発行</summary>
        <form
          action={createCouponByAdmin}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
        >
          <div className="field">
            <span className="muted">店舗 *</span>
            <select name="storeId" required defaultValue="">
              <option value="" disabled>
                選択してください
              </option>
              {allStores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">タイトル *</span>
            <input type="text" name="title" required />
          </div>
          <div className="field">
            <span className="muted">割引内容</span>
            <input type="text" name="discount" placeholder="例: 20%OFF" />
          </div>
          <div className="field">
            <span className="muted">説明</span>
            <textarea name="description" rows={2} />
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
            <span className="muted">利用可能回数（空欄で無制限）</span>
            <input type="number" name="usageLimit" min={1} />
          </div>
          <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
            発行する
          </button>
        </form>
      </details>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="タイトル・店舗名で検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 220,
          }}
        />
        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
          }}
        >
          <option value="all">すべて</option>
          <option value="active">公開中</option>
          <option value="inactive">停止中</option>
        </select>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      {(!coupons || coupons.length === 0) && <p className="muted">該当するクーポンはありません。</p>}

      {coupons && coupons.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>店舗</th>
              <th>タイトル</th>
              <th>割引内容</th>
              <th>コード</th>
              <th>有効期限</th>
              <th>利用数</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c: any) => {
              const expired = c.valid_until && c.valid_until < today;
              return (
                <tr key={c.id}>
                  <td>{c.stores?.name ?? ""}</td>
                  <td>{c.title}</td>
                  <td>{c.discount ?? ""}</td>
                  <td>{c.code ?? ""}</td>
                  <td>
                    {c.valid_until ?? ""}
                    {expired && (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        期限切れ
                      </span>
                    )}
                  </td>
                  <td className="tabular">
                    {c.used_count ?? 0}/{c.usage_limit ?? "∞"}
                  </td>
                  <td>
                    <span className="badge">{c.active ? "公開中" : "停止中"}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      <form
                        action={async () => {
                          "use server";
                          await setCouponActive(c.id, !c.active);
                        }}
                      >
                        <button type="submit" className="btn" style={{ fontSize: 12 }}>
                          {c.active ? "公開停止" : "再公開"}
                        </button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await deleteCoupon(c.id);
                        }}
                      >
                        <button type="submit" className="btn" style={{ fontSize: 12 }}>
                          削除
                        </button>
                      </form>
                    </div>
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 12.5 }}>編集</summary>
                      <form
                        action={updateCouponByAdmin}
                        style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, minWidth: 200 }}
                      >
                        <input type="hidden" name="couponId" value={c.id} />
                        <div className="field">
                          <span className="muted">タイトル *</span>
                          <input type="text" name="title" defaultValue={c.title} required />
                        </div>
                        <div className="field">
                          <span className="muted">割引内容</span>
                          <input type="text" name="discount" defaultValue={c.discount ?? ""} />
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
                          <span className="muted">利用可能回数</span>
                          <input
                            type="number"
                            name="usageLimit"
                            min={1}
                            defaultValue={c.usage_limit ?? ""}
                          />
                        </div>
                        <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
                          保存する
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

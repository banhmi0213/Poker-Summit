import { createClient } from "@/lib/supabase/server";
import { setCouponActive, deleteCoupon } from "./actions";

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q ?? "";
  const status = searchParams.status ?? "all";

  let query = supabase
    .from("coupons")
    .select("id, title, discount, code, valid_until, active, store_id, stores(name)")
    .order("created_at", { ascending: false });

  if (status === "active") {
    query = query.eq("active", true);
  } else if (status === "inactive") {
    query = query.eq("active", false);
  }
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: coupons } = await query;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>クーポン管理（全店舗）</h1>

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="クーポンタイトルで検索"
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
                  <td>
                    <span className="badge">{c.active ? "公開中" : "停止中"}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

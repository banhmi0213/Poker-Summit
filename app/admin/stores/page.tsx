import { createClient } from "@/lib/supabase/server";
import { setStoreStatus, setStoreOwnerByEmail } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  listed: "掲載済み",
};

export default async function AdminStoresPage() {
  const supabase = await createClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, category, region, pref, status, owner_user_id, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>店舗管理</h1>

      <table>
        <thead>
          <tr>
            <th>店舗名</th>
            <th>エリア</th>
            <th>ステータス</th>
            <th>オーナー</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {stores?.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{[s.region, s.pref].filter(Boolean).join(" / ")}</td>
              <td>
                <span className="badge">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </td>
              <td>
                <div style={{ marginBottom: 6 }}>
                  <span className="badge">
                    {s.owner_user_id ? "設定済み" : "未設定"}
                  </span>
                </div>
                <form
                  action={setStoreOwnerByEmail}
                  style={{ display: "flex", gap: 6 }}
                >
                  <input type="hidden" name="storeId" value={s.id} />
                  <input
                    type="email"
                    name="email"
                    placeholder="オーナーのメール"
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      fontSize: 12.5,
                      width: 170,
                    }}
                  />
                  <button type="submit" className="btn" style={{ padding: "6px 10px", fontSize: 12.5 }}>
                    設定
                  </button>
                </form>
              </td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <form
                    action={async () => {
                      "use server";
                      await setStoreStatus(s.id, "approved");
                    }}
                  >
                    <button type="submit" className="btn primary">
                      承認
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await setStoreStatus(s.id, "rejected");
                    }}
                  >
                    <button type="submit" className="btn">
                      却下
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

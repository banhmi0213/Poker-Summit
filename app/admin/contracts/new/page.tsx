import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createContract } from "../actions";

function formatYen(value: number | null | undefined) {
  return `¥${(value ?? 0).toLocaleString("ja-JP")}`;
}

export default async function NewContractPage() {
  const supabase = await createClient();

  const [{ data: stores }, { data: existingContracts }, { data: plans }, { data: addons }] =
    await Promise.all([
      supabase
        .from("stores")
        .select("id, name, pref")
        .in("status", ["approved", "listed"])
        .order("name", { ascending: true }),
      supabase.from("store_contracts").select("store_id"),
      supabase.from("plans").select("id, name, monthly_fee").eq("active", true).order("sort_order"),
      supabase.from("addons").select("id, name, monthly_fee").eq("active", true).order("sort_order"),
    ]);

  const contractedStoreIds = new Set((existingContracts ?? []).map((c) => c.store_id));
  const availableStores = (stores ?? []).filter((s) => !contractedStoreIds.has(s.id));

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22 }}>契約を登録</h1>
        <Link href="/admin/contracts" className="btn">
          一覧に戻る
        </Link>
      </div>

      {availableStores.length === 0 ? (
        <p className="muted">
          未契約の掲載店舗がありません。先に{" "}
          <Link href="/admin/stores">店舗管理</Link> で店舗を掲載してください。
        </p>
      ) : (!plans || plans.length === 0) ? (
        <p className="muted">
          有効なプランがありません。先に{" "}
          <Link href="/admin/contracts/plans">プラン・アドオン管理</Link> でプランを登録してください。
        </p>
      ) : (
        <form action={createContract} className="card" style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            店舗
            <select name="storeId" required style={fieldStyle}>
              <option value="">選択してください</option>
              {availableStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.pref ? `（${s.pref}）` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            月額プラン
            <select name="planId" required style={fieldStyle}>
              <option value="">選択してください</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{formatYen(p.monthly_fee)}）
                </option>
              ))}
            </select>
          </label>

          {addons && addons.length > 0 && (
            <div>
              <div style={{ marginBottom: 6 }}>アドオン</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {addons.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                    <input type="checkbox" name="addonIds" value={a.id} />
                    {a.name}（{formatYen(a.monthly_fee)}）
                  </label>
                ))}
              </div>
            </div>
          )}

          <label>
            請求先担当者名
            <input type="text" name="contactName" style={fieldStyle} />
          </label>
          <label>
            請求先メールアドレス
            <input type="email" name="contactEmail" style={fieldStyle} />
          </label>
          <label>
            請求先電話番号
            <input type="tel" name="contactTel" style={fieldStyle} />
          </label>

          <button type="submit" className="btn primary" style={{ marginTop: 4 }}>
            登録する
          </button>
        </form>
      )}
    </div>
  );
}

const fieldStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  fontSize: 13.5,
} as const;

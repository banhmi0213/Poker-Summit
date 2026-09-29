import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  createPlan,
  updatePlan,
  togglePlanActive,
  createAddon,
  updateAddon,
  toggleAddonActive,
} from "../actions";

function formatYen(value: number | null | undefined) {
  return `¥${(value ?? 0).toLocaleString("ja-JP")}`;
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

export default async function ContractPlansPage() {
  const supabase = await createClient();

  const [{ data: plans }, { data: addons }] = await Promise.all([
    supabase.from("plans").select("*").order("sort_order"),
    supabase.from("addons").select("*").order("sort_order"),
  ]);

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22 }}>プラン・アドオン管理</h1>
        <Link href="/admin/contracts" className="btn">
          契約一覧に戻る
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 }}>
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>月額プラン</h2>

          {(!plans || plans.length === 0) && <p className="muted">プランがまだ登録されていません。</p>}

          {plans && plans.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {plans.map((p) => (
                <div key={p.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{p.name}</span>{" "}
                      <span className="muted">（{formatYen(p.monthly_fee)}/月）</span>{" "}
                      <span className={`badge ${p.active ? "" : "outline"}`}>{p.active ? "有効" : "停止中"}</span>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await togglePlanActive(p.id, !p.active);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        {p.active ? "停止する" : "有効にする"}
                      </button>
                    </form>
                  </div>
                  {p.description && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{p.description}</p>}
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5 }}>編集</summary>
                    <form action={updatePlan} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      <input type="hidden" name="planId" value={p.id} />
                      <label>
                        プラン名
                        <input type="text" name="name" defaultValue={p.name} required style={fieldStyle} />
                      </label>
                      <label>
                        月額料金(円)
                        <input type="number" name="monthlyFee" defaultValue={p.monthly_fee} style={fieldStyle} />
                      </label>
                      <label>
                        説明
                        <input type="text" name="description" defaultValue={p.description ?? ""} style={fieldStyle} />
                      </label>
                      <label>
                        表示順
                        <input type="number" name="sortOrder" defaultValue={p.sort_order} style={fieldStyle} />
                      </label>
                      <button type="submit" className="btn primary" style={{ fontSize: 12, alignSelf: "flex-start" }}>
                        保存する
                      </button>
                    </form>
                  </details>
                </div>
              ))}
            </div>
          )}

          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>新しいプランを追加</summary>
            <form action={createPlan} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <label>
                プラン名
                <input type="text" name="name" required style={fieldStyle} />
              </label>
              <label>
                月額料金(円)
                <input type="number" name="monthlyFee" defaultValue={0} style={fieldStyle} />
              </label>
              <label>
                説明
                <input type="text" name="description" style={fieldStyle} />
              </label>
              <label>
                表示順
                <input type="number" name="sortOrder" defaultValue={0} style={fieldStyle} />
              </label>
              <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
                追加する
              </button>
            </form>
          </details>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>アドオン</h2>

          {(!addons || addons.length === 0) && <p className="muted">アドオンがまだ登録されていません。</p>}

          {addons && addons.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {addons.map((a) => (
                <div key={a.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{a.name}</span>{" "}
                      <span className="muted">（{formatYen(a.monthly_fee)}/月）</span>{" "}
                      <span className={`badge ${a.active ? "" : "outline"}`}>{a.active ? "有効" : "停止中"}</span>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await toggleAddonActive(a.id, !a.active);
                      }}
                    >
                      <button type="submit" className="btn" style={{ fontSize: 12 }}>
                        {a.active ? "停止する" : "有効にする"}
                      </button>
                    </form>
                  </div>
                  {a.description && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{a.description}</p>}
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5 }}>編集</summary>
                    <form action={updateAddon} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      <input type="hidden" name="addonId" value={a.id} />
                      <label>
                        アドオン名
                        <input type="text" name="name" defaultValue={a.name} required style={fieldStyle} />
                      </label>
                      <label>
                        月額料金(円)
                        <input type="number" name="monthlyFee" defaultValue={a.monthly_fee} style={fieldStyle} />
                      </label>
                      <label>
                        説明
                        <input type="text" name="description" defaultValue={a.description ?? ""} style={fieldStyle} />
                      </label>
                      <label>
                        表示順
                        <input type="number" name="sortOrder" defaultValue={a.sort_order} style={fieldStyle} />
                      </label>
                      <button type="submit" className="btn primary" style={{ fontSize: 12, alignSelf: "flex-start" }}>
                        保存する
                      </button>
                    </form>
                  </details>
                </div>
              ))}
            </div>
          )}

          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>新しいアドオンを追加</summary>
            <form action={createAddon} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <label>
                アドオン名
                <input type="text" name="name" required style={fieldStyle} />
              </label>
              <label>
                月額料金(円)
                <input type="number" name="monthlyFee" defaultValue={0} style={fieldStyle} />
              </label>
              <label>
                説明
                <input type="text" name="description" style={fieldStyle} />
              </label>
              <label>
                表示順
                <input type="number" name="sortOrder" defaultValue={0} style={fieldStyle} />
              </label>
              <button type="submit" className="btn primary" style={{ alignSelf: "flex-start" }}>
                追加する
              </button>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}

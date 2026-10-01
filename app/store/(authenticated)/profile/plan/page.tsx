import Link from "next/link";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { requestPlanChange, cancelPlanChangeRequest } from "../plan-actions";
import { requestAddonChange, cancelAddonChangeRequest } from "../addons-actions";

// /store/profile 1ページの中の1セクションだったプラン・アップグレードを、
// 独立したページへ分離(2026/09/30)。LINEリッチメニュー側の導線と同じ
// 機能をPCの店舗管理画面からも使えるようにするため新設した機能。
export default async function StorePlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/store/login?next=/store/profile/plan");
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

  const [{ data: contract }, { data: allPlans }, { data: pendingPlanRequest }, { data: allAddons }, { data: pendingAddonRequest }] =
    await Promise.all([
      supabase
        .from("store_contracts")
        .select(
          "id, status, plan_id, current_period_end, fincode_customer_id, plans(id, name, monthly_fee, description), store_contract_addons(addon_id)"
        )
        .eq("store_id", store.id)
        .maybeSingle(),
      supabase
        .from("plans")
        .select("id, name, monthly_fee, description")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("plan_change_requests")
        .select("id, requested_plan_id, note, requested_at, plans:requested_plan_id(name, monthly_fee)")
        .eq("store_id", store.id)
        .eq("status", "pending")
        .maybeSingle(),
      supabase
        .from("addons")
        .select("id, name, monthly_fee, description")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("addon_change_requests")
        .select("id, requested_addon_ids, note, requested_at")
        .eq("store_id", store.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

  const currentAddonIds = ((contract as any)?.store_contract_addons ?? []).map(
    (a: { addon_id: string }) => a.addon_id
  ) as string[];

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>プラン・アドオン</h1>

      {contract && !contract.fincode_customer_id && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#d1453b", background: "rgba(209, 69, 59, 0.08)" }}>
          <div style={{ color: "#d1453b", fontSize: 13.5 }}>
            ⚠️ カード情報が登録されていないため、プラン・アドオンの変更に伴うカード決済ができません。運営にお問い合わせください。
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ marginBottom: 12 }}>
          <span className="muted">現在のプラン</span>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>
            {contract?.plans
              ? `${(contract.plans as { name: string }).name}（¥${(
                  (contract.plans as { monthly_fee: number }).monthly_fee ?? 0
                ).toLocaleString("ja-JP")}/月）`
              : "未契約・プラン未設定"}
          </div>
          {contract?.current_period_end && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              現在の契約期間: 〜{new Date(contract.current_period_end).toLocaleDateString("ja-JP")}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, marginBottom: 4 }}>
          <span className="muted">料金プラン一覧</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {(allPlans ?? []).map((p) => {
            const isCurrent = p.id === contract?.plan_id;
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  background: "var(--surface-2)",
                  border: isCurrent ? "2px solid var(--accent, #c9a24b)" : undefined,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {p.name}
                  {isCurrent && (
                    <span className="badge" style={{ marginLeft: 6, fontSize: 10.5 }}>
                      現在のプラン
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                  ¥{(p.monthly_fee ?? 0).toLocaleString("ja-JP")}
                  <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                    /月
                  </span>
                </div>
                {p.description && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6, whiteSpace: "pre-wrap" }}>
                    {p.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {pendingPlanRequest ? (
          <div className="card" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
            <div style={{ fontSize: 13.5 }}>
              ⏳「
              {(pendingPlanRequest.plans as { name?: string } | null)?.name ?? "選択したプラン"}
              」へのダウングレードを予約しています。
              {contract?.current_period_end
                ? `現在の契約期間が終わる ${new Date(contract.current_period_end).toLocaleDateString("ja-JP")} に新しい料金で切り替わります。`
                : "現在の契約期間が終わるタイミングで新しい料金に切り替わります。"}
            </div>
            {pendingPlanRequest.note && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                メモ: {pendingPlanRequest.note}
              </div>
            )}
            <form
              action={async () => {
                "use server";
                await cancelPlanChangeRequest(pendingPlanRequest.id);
              }}
              style={{ marginTop: 8 }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12 }}>
                予約を取り消す
              </button>
            </form>
          </div>
        ) : (
          <form action={requestPlanChange}>
            <input type="hidden" name="storeId" value={store.id} />
            <div className="field">
              <span className="muted">変更したいプラン</span>
              <select name="requestedPlanId" required defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {(allPlans ?? []).map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === contract?.plan_id}>
                    {p.name}（¥{(p.monthly_fee ?? 0).toLocaleString("ja-JP")}/月）
                    {p.id === contract?.plan_id ? "・現在のプラン" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="muted">運営への連絡事項（任意）</span>
              <textarea name="note" rows={3} placeholder="例: 来月から求人枠を増やしたいです" />
            </div>
            <button type="submit" className="btn primary">
              プラン変更を申請する
            </button>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              料金が上がるプランへの変更は、送信時にカード決済が即時実行され、成功次第すぐに反映されます(日割りなし・満額請求)。料金が下がるプランへの変更は、現在の契約期間が終わるタイミングで反映されます。
            </p>
          </form>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <span className="muted">現在契約中のアドオン</span>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>
            {currentAddonIds.length > 0
              ? (allAddons ?? [])
                  .filter((a) => currentAddonIds.includes(a.id))
                  .map((a) => a.name)
                  .join("、")
              : "なし"}
          </div>
        </div>

        <div style={{ marginTop: 20, marginBottom: 4 }}>
          <span className="muted">アドオン一覧</span>
        </div>

        {pendingAddonRequest ? (
          <div className="card" style={{ background: "var(--surface-2)", marginBottom: 12, marginTop: 10 }}>
            <div style={{ fontSize: 13.5 }}>
              ⏳ アドオンを「
              {pendingAddonRequest.requested_addon_ids.length > 0
                ? (allAddons ?? [])
                    .filter((a) => pendingAddonRequest.requested_addon_ids.includes(a.id))
                    .map((a) => a.name)
                    .join("、")
                : "なし"}
              」の構成に変更するよう予約しています。
              {contract?.current_period_end
                ? `現在の契約期間が終わる ${new Date(contract.current_period_end).toLocaleDateString("ja-JP")} に反映されます。`
                : "現在の契約期間が終わるタイミングで反映されます。"}
            </div>
            {pendingAddonRequest.note && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                メモ: {pendingAddonRequest.note}
              </div>
            )}
            <form
              action={async () => {
                "use server";
                await cancelAddonChangeRequest(pendingAddonRequest.id);
              }}
              style={{ marginTop: 8 }}
            >
              <button type="submit" className="btn" style={{ fontSize: 12 }}>
                予約を取り消す
              </button>
            </form>
          </div>
        ) : (
          <form action={requestAddonChange} style={{ marginTop: 10 }}>
            <input type="hidden" name="storeId" value={store.id} />
            <div className="field">
              <span className="muted">申し込みたいアドオン（複数選択可）</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {(allAddons ?? []).length === 0 && (
                  <p className="muted" style={{ fontSize: 12.5 }}>
                    現在申し込めるアドオンはありません。
                  </p>
                )}
                {(allAddons ?? []).map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5 }}>
                    <input
                      type="checkbox"
                      name="addonIds"
                      value={a.id}
                      defaultChecked={currentAddonIds.includes(a.id)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <strong>{a.name}</strong>（¥{(a.monthly_fee ?? 0).toLocaleString("ja-JP")}/月）
                      {a.description && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {a.description}
                        </div>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="muted">運営への連絡事項（任意）</span>
              <textarea name="note" rows={3} placeholder="例: 来月から求人アドオンを使いたいです" />
            </div>
            <button type="submit" className="btn primary">
              アドオン変更を申請する
            </button>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              アドオンの追加を含む変更は、送信時に新しい構成の合計金額でカード決済が即時実行され、成功次第すぐに反映されます。解除のみの変更は、現在の契約期間が終わるタイミングで反映されます。
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

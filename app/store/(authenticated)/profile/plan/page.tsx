import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestPlanChange, cancelPlanChangeRequest } from "../plan-actions";

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

  const [{ data: contract }, { data: allPlans }, { data: pendingPlanRequest }] = await Promise.all([
    supabase
      .from("store_contracts")
      .select("id, status, plan_id, plans(id, name, monthly_fee, description)")
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
  ]);

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>プラン・アップグレード</h1>

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
              」への変更を運営に申請中です。運営の確認後に反映されます。
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
                申請を取り消す
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
              申請後、運営が内容を確認し決済・契約内容を更新します。反映まで少しお時間をいただく場合があります。
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

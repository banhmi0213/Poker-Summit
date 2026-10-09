import Link from "next/link";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { redirect } from "next/navigation";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { requestPlanChange, cancelPlanChangeRequest } from "../plan-actions";
import { AddonsSection } from "./addons-section";
import { getActiveAddons, addonSlotsLeft } from "@/lib/addons";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { cycleLabel, formatJpDate, getBillingSettings, isOverdue, isoToJstDate, todayJst, type InvoiceRow } from "@/lib/bank-transfer";

// /store/profile 1ページの中の1セクションだったプラン・アップグレードを、
// 独立したページへ分離(2026/09/30)。LINEリッチメニュー側の導線と同じ
// 機能をPCの店舗管理画面からも使えるようにするため新設した機能。
export default async function StorePlanPage({
  searchParams,
}: {
  searchParams?: { ok?: string; error?: string };
}) {
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
          "id, status, plan_id, current_period_end, fincode_customer_id, billing_method, billing_cycle_months, suspended_for_nonpayment_at, plans!store_contracts_plan_id_fkey(id, name, monthly_fee, description), store_contract_addons(id, addon_id, billing_method, current_period_end, pending_removed_at, fee)"
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

  const isTransfer = (contract as any)?.billing_method === "bank_transfer";
  const [{ data: invoiceRows }, billing] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("store_id", store.id)
      .neq("status", "canceled")
      .order("issued_at", { ascending: false })
      .limit(24),
    getBillingSettings(),
  ]);
  const invoices = (invoiceRows ?? []) as InvoiceRow[];
  const today = todayJst();
  const unpaid = invoices.filter((i) => i.status === "unpaid");

  const svc = createServiceRoleClient();
  const [{ data: storeRow }, addonList, { data: creditRow }, { data: orderRows }] = await Promise.all([
    supabase.from("stores").select("pref").eq("id", store.id).maybeSingle(),
    getActiveAddons(supabase),
    supabase.from("store_spot_credits").select("balance").eq("store_id", store.id).maybeSingle(),
    supabase
      .from("addon_orders")
      .select("id, addon_name, quantity, total_amount, payment_method, status, invoice_id, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const storePref = (storeRow?.pref as string | null) ?? null;
  const contractAddons = ((contract as any)?.store_contract_addons ?? []) as any[];
  const slotsLeft: Record<string, number | null> = {};
  for (const a of addonList.filter((x) => x.billing_type === "monthly")) {
    slotsLeft[a.id] = await addonSlotsLeft(svc, a, storePref, store.id);
  }
  const spotCredits = (creditRow?.balance as number | undefined) ?? 0;
  const addonOrders = (orderRows ?? []) as any[];

  const currentAddonIds = ((contract as any)?.store_contract_addons ?? []).map(
    (a: { addon_id: string }) => a.addon_id
  ) as string[];

  return (
    <div>
      <Link href="/store/profile" className="btn" style={{ marginBottom: 16, display: "inline-flex" }}>
        ← 店舗管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>プラン・お支払い</h1>

      {searchParams?.ok && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#2e7d32", background: "rgba(46, 125, 50, 0.08)", fontSize: 13.5 }}>
          ✅ {searchParams.ok}
        </div>
      )}
      {searchParams?.error && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#d1453b", background: "rgba(209, 69, 59, 0.08)", color: "#d1453b", fontSize: 13.5 }}>
          ⚠️ {searchParams.error}
        </div>
      )}

      {(contract as any)?.suspended_for_nonpayment_at && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#d1453b", background: "rgba(209, 69, 59, 0.08)" }}>
          <div style={{ color: "#d1453b", fontSize: 13.5, fontWeight: 700 }}>
            ⚠️ お支払期限までにご入金を確認できなかったため、店舗ページの公開を停止しています。
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>下記の請求書の金額をお振り込みください。ご入金の確認後、公開を再開します。</div>
        </div>
      )}

      {(isTransfer || invoices.length > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="muted">お支払い方法</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>
            {isTransfer ? `銀行振込（${cycleLabel((contract as any)?.billing_cycle_months ?? 1)}）` : "クレジットカード"}
          </div>
          {isTransfer && (
            <p className="muted" style={{ fontSize: 12, margin: "4px 0 0", lineHeight: 1.7 }}>
              契約期間が終わる7日前に次回分の請求書をメールでお送りします。お支払期限は請求書の発行から{billing.dueDays}日以内です（振込手数料はご負担ください）。
            </p>
          )}

          {unpaid.length > 0 && billing.bank && (
            <div className="card" style={{ background: "var(--surface-2)", marginTop: 12, fontSize: 13.5, lineHeight: 1.8 }}>
              <div className="muted" style={{ fontSize: 12 }}>お振込先</div>
              <div>
                {billing.bank.bank} {billing.bank.branch}
              </div>
              <div>
                {billing.bank.type} {billing.bank.number}　口座名義：{billing.bank.holder}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <span className="muted">請求書</span>
            {invoices.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>まだ請求書はありません。</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {invoices.map((inv) => {
                  const overdue = isOverdue(inv, today);
                  return (
                    <div
                      key={inv.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                        padding: "8px 0",
                        borderTop: "1px solid rgba(0,0,0,0.08)",
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {inv.kind === "addon" ? `アドオン：${inv.plan_name}` : `${inv.plan_name}・${cycleLabel(inv.months, inv.discount_label)}`}
                        </div>
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          {inv.invoice_number}・発行 {formatJpDate(isoToJstDate(inv.issued_at))}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700 }}>{inv.total_amount.toLocaleString("ja-JP")}円</div>
                        <div style={{ fontSize: 11.5, color: overdue ? "#d1453b" : undefined, fontWeight: overdue ? 700 : 400 }}>
                          {inv.status === "paid" ? "お支払い済み" : `お支払期限 ${formatJpDate(inv.due_date)}${overdue ? "（期限超過）" : ""}`}
                        </div>
                      </div>
                      <a className="btn" href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                        PDF
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {contract && !isTransfer && !contract.fincode_customer_id && (
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
        ) : isTransfer ? (
          <div className="card" style={{ background: "var(--surface-2)", fontSize: 13.5, lineHeight: 1.8 }}>
            銀行振込でご契約中のため、プランやお支払いサイクル（毎月・6か月・12か月）の変更は
            <a href="/contact" style={{ textDecoration: "underline", fontWeight: 600 }}>お問い合わせフォーム</a>
            からご連絡ください。変更後の内容で請求書をお送りします。
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
            <PendingSubmitButton pendingLabel="決済・変更の処理中…（画面を閉じずにお待ちください）">
              プラン変更を申請する
            </PendingSubmitButton>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              料金が上がるプランへの変更は、送信時にカード決済が即時実行され、成功次第すぐに反映されます(日割りなし・満額請求)。料金が下がるプランへの変更は、現在の契約期間が終わるタイミングで反映されます。
            </p>
          </form>
        )}
      </div>

      <AddonsSection
        addons={addonList}
        pref={storePref}
        contractAddons={contractAddons}
        contractPeriodEnd={(contract as any)?.current_period_end ?? null}
        slotsLeft={slotsLeft}
        spotCredits={spotCredits}
        orders={addonOrders}
        canUseCard={billing.cardPaymentEnabled && !!contract?.fincode_customer_id}
        hasContract={(contract as any)?.status === "active"}
        planFee={((contract as any)?.plans?.monthly_fee as number | undefined) ?? 0}
      />
    </div>
  );
}

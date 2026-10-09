import { PendingSubmitButton } from "@/app/pending-submit-button";
import { addonFeeFor, addonPriceLabel, ORDER_STATUS_LABEL, type AddonRow } from "@/lib/addons";
import { purchaseAddonAction, cancelAddonAction } from "../addon-purchase-actions";

type ContractAddon = {
  id: string;
  addon_id: string;
  billing_method: string | null;
  current_period_end: string | null;
  pending_removed_at: string | null;
  fee: number | null;
};

type Order = {
  id: string;
  addon_name: string;
  quantity: number;
  total_amount: number;
  payment_method: string;
  status: string;
  invoice_id: string | null;
  created_at: string;
};

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const jpDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) : "");

// 店舗管理「プラン・お支払い」のアドオン欄(2026/10)。月額と都度払いに分けて表示し、
// 地域PICKUPは店舗の登録住所の都道府県で料金を自動で切り替える。
export function AddonsSection({
  addons,
  pref,
  contractAddons,
  contractPeriodEnd,
  slotsLeft,
  spotCredits,
  orders,
  canUseCard,
  hasContract,
}: {
  addons: AddonRow[];
  pref: string | null;
  contractAddons: ContractAddon[];
  contractPeriodEnd: string | null;
  slotsLeft: Record<string, number | null>;
  spotCredits: number;
  orders: Order[];
  canUseCard: boolean;
  hasContract: boolean;
}) {
  const monthly = addons.filter((a) => a.billing_type === "monthly");
  const oneTime = addons.filter((a) => a.billing_type === "one_time");

  const payment = (name: string) => (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
      {canUseCard && (
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name={name} value="card" defaultChecked />
          クレジットカード
        </label>
      )}
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="radio" name={name} value="bank_transfer" defaultChecked={!canUseCard} />
        銀行振込（請求書）
      </label>
    </div>
  );

  return (
    <div className="card" id="addons" style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>アドオン</h2>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.7 }}>
        お支払いはクレジットカードまたは銀行振込（請求書）を選べます。銀行振込はご入金の確認後に有効になります。
      </p>

      {!hasContract && <p className="err">有効な契約がないため、アドオンをお申し込みいただけません。</p>}

      <h3 style={{ fontSize: 14.5, margin: "6px 0 8px" }}>月額のアドオン</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {monthly.map((a) => {
          const mine = contractAddons.find((c) => c.addon_id === a.id);
          const left = slotsLeft[a.id] ?? null;
          const fee = addonFeeFor(a, pref);
          const endIso = mine ? (mine.billing_method === "bank_transfer" ? mine.current_period_end : contractPeriodEnd) : null;
          return (
            <div key={a.id} className="card" style={{ background: "var(--surface-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14.5 }}>{a.name}</strong>
                <span style={{ fontWeight: 700 }}>
                  {yen(fee)}/月
                </span>
              </div>
              {a.description && <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 8px", lineHeight: 1.7 }}>{a.description}</p>}
              {mine ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                  <span className="badge">ご契約中</span>
                  <span className="muted">
                    {mine.billing_method === "bank_transfer" ? "銀行振込" : "カード"}
                    {mine.pending_removed_at
                      ? `・${jpDate(mine.pending_removed_at)}に解約予定`
                      : endIso
                        ? `・次回更新 ${jpDate(endIso)}`
                        : ""}
                  </span>
                  {!mine.pending_removed_at && (
                    <form action={cancelAddonAction}>
                      <input type="hidden" name="storeContractAddonId" value={mine.id} />
                      <PendingSubmitButton className="btn" pendingLabel="処理中…" style={{ fontSize: 12 }}>
                        解約する（期間の終わりまで利用可）
                      </PendingSubmitButton>
                    </form>
                  )}
                </div>
              ) : left !== null && left <= 0 ? (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  現在満枠です（{a.capacity_scope === "pref" ? `${pref ?? "この地域"}で` : "全国で"}{a.capacity}店舗まで）。空きが出るまでお待ちください。
                </p>
              ) : (
                hasContract && (
                  <form action={purchaseAddonAction} style={{ display: "grid", gap: 8 }}>
                    <input type="hidden" name="addonId" value={a.id} />
                    {left !== null && <span className="muted" style={{ fontSize: 12 }}>残り{left}枠</span>}
                    {payment("paymentMethod")}
                    {a.needs_fulfillment && (
                      <textarea name="note" rows={2} placeholder="運営への連絡事項（任意）" style={{ fontSize: 13 }} />
                    )}
                    <div>
                      <PendingSubmitButton pendingLabel="処理中…">申し込む</PendingSubmitButton>
                    </div>
                    {canUseCard && (
                      <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
                        カードの場合は、プランとカード払いのアドオンの合計額をその場で決済し、契約期間を今日から1か月に更新します。
                      </p>
                    )}
                  </form>
                )
              )}
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: 14.5, margin: "18px 0 8px" }}>都度払いのアドオン</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {oneTime.map((a) => (
          <div key={a.id} className="card" style={{ background: "var(--surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14.5 }}>{a.name}</strong>
              <span style={{ fontWeight: 700 }}>{addonPriceLabel(a)}</span>
            </div>
            {a.description && <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 8px", lineHeight: 1.7 }}>{a.description}</p>}
            {a.code === "spot_job_credit" && (
              <p style={{ fontSize: 13, margin: "0 0 8px" }}>
                現在の追加掲載枠：<strong>{spotCredits}件</strong>
              </p>
            )}
            {hasContract && (
              <form action={purchaseAddonAction} style={{ display: "grid", gap: 8 }}>
                <input type="hidden" name="addonId" value={a.id} />
                {a.code === "spot_job_credit" && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    件数
                    <input type="number" name="quantity" min={1} max={50} defaultValue={1} style={{ width: 80 }} />
                  </label>
                )}
                {payment("paymentMethod")}
                {a.needs_fulfillment && (
                  <textarea name="note" rows={2} placeholder="ご希望の日程・内容など（任意）" style={{ fontSize: 13 }} />
                )}
                <div>
                  <PendingSubmitButton pendingLabel="処理中…">申し込む</PendingSubmitButton>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <>
          <h3 style={{ fontSize: 14.5, margin: "18px 0 8px" }}>アドオンのお申し込み履歴</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {orders.map((o) => (
              <div
                key={o.id}
                style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, padding: "6px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}
              >
                <span>
                  {o.addon_name}
                  {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                  <span className="muted" style={{ fontSize: 11.5 }}>　{jpDate(o.created_at)}</span>
                </span>
                <span>
                  {yen(o.total_amount)}（{o.payment_method === "card" ? "カード" : "振込"}）
                  <span className="badge" style={{ marginLeft: 6, fontSize: 10.5 }}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                  {o.invoice_id && (
                    <a href={`/api/invoices/${o.invoice_id}/pdf`} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: 12, textDecoration: "underline" }}>
                      請求書
                    </a>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

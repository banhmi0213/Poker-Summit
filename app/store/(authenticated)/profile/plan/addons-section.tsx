import { PendingSubmitButton } from "@/app/pending-submit-button";
import { addonFeeFor, ORDER_STATUS_LABEL, type AddonRow } from "@/lib/addons";
import { AddonPicker, type PickerAddon } from "./addon-picker";
import { cancelAddonAction } from "../addon-purchase-actions";

type ContractAddon = {
  id: string;
  addon_id: string;
  billing_method: string | null;
  current_period_end: string | null;
  pending_removed_at: string | null;
  fee: number | null;
  fincode_subscription_id?: string | null;
};

// 申込日から1か月ごとに自動更新される期間の、次の区切り
function rollForward(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = Date.now();
  for (let i = 0; i < 240 && d.getTime() <= now; i++) d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

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
  planFee,
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
  planFee: number;
}) {

  const mine = contractAddons
    .map((c) => ({ c, addon: addons.find((a) => a.id === c.addon_id) }))
    .filter((x) => !!x.addon);

  const pickerAddons: PickerAddon[] = addons.map((a) => {
    const contracted = contractAddons.some((c) => c.addon_id === a.id);
    const left = slotsLeft[a.id] ?? null;
    const disabledReason =
      a.billing_type === "monthly" && contracted
        ? "ご契約中"
        : a.billing_type === "monthly" && left !== null && left <= 0
          ? "現在満枠です"
          : null;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      description: a.description,
      billingType: a.billing_type,
      fee: addonFeeFor(a, pref),
      disabledReason,
      maxQuantity: a.code === "spot_job_credit" ? 50 : 1,
    };
  });

  return (
    <div className="card" id="addons" style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>アドオン</h2>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px", lineHeight: 1.7 }}>
        使いたいアドオンにチェックを入れて、まとめてお申し込みいただけます。お支払いはクレジットカードまたは銀行振込（請求書）です。
      </p>

      {mine.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>ご契約中の月額アドオン</div>
          <div style={{ display: "grid", gap: 6 }}>
            {mine.map(({ c, addon }) => {
              const endIso =
                c.billing_method === "bank_transfer"
                  ? c.current_period_end
                  : c.fincode_subscription_id
                    ? rollForward(c.current_period_end)
                    : contractPeriodEnd;
              return (
                <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                  <strong>{addon!.name}</strong>
                  <span className="muted">
                    {yen(c.fee ?? addonFeeFor(addon!, pref))}/月・{c.billing_method === "bank_transfer" ? "銀行振込" : "カード"}
                    {c.pending_removed_at ? `・${jpDate(c.pending_removed_at)}に解約予定` : endIso ? `・次回更新 ${jpDate(endIso)}` : ""}
                  </span>
                  {!c.pending_removed_at && (
                    <form action={cancelAddonAction}>
                      <input type="hidden" name="storeContractAddonId" value={c.id} />
                      <PendingSubmitButton className="btn" pendingLabel="処理中…" style={{ fontSize: 12 }}>
                        解約する
                      </PendingSubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {spotCredits > 0 && (
        <p style={{ fontSize: 13, margin: "0 0 8px" }}>
          スポット求人の追加掲載枠：<strong>{spotCredits}件</strong>
        </p>
      )}

      {hasContract ? (
        <AddonPicker addons={pickerAddons} canUseCard={canUseCard} />
      ) : (
        <p className="err">有効な契約がないため、アドオンをお申し込みいただけません。</p>
      )}

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

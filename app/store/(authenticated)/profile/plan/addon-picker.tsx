"use client";

import { useMemo, useState } from "react";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { purchaseAddonAction } from "../addon-purchase-actions";

export type PickerAddon = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  billingType: "monthly" | "one_time";
  fee: number;
  disabledReason: string | null; // ご契約中・満枠など
  maxQuantity: number; // 1 = 数量なし
};

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

// アドオンをまとめて選んで1回で申し込むフォーム(2026/10)。合計はその場で計算して表示。
export function AddonPicker({ addons, canUseCard }: { addons: PickerAddon[]; canUseCard: boolean }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"card" | "bank_transfer">(canUseCard ? "card" : "bank_transfer");

  const { monthlyTotal, oneTimeTotal } = useMemo(() => {
    let monthlyTotal = 0;
    let oneTimeTotal = 0;
    for (const a of addons) {
      if (!selected[a.id]) continue;
      const amount = a.fee * (a.maxQuantity > 1 ? qty[a.id] ?? 1 : 1);
      if (a.billingType === "monthly") monthlyTotal += amount;
      else oneTimeTotal += amount;
    }
    return { monthlyTotal, oneTimeTotal };
  }, [addons, selected, qty]);
  const anySelected = Object.values(selected).some(Boolean);
  const anyMonthly = addons.some((a) => a.billingType === "monthly" && selected[a.id]);

  const group = (type: "monthly" | "one_time", title: string) => {
    const list = addons.filter((a) => a.billingType === type);
    if (!list.length) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>{title}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {list.map((a) => (
            <label
              key={a.id}
              className="card"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                background: "var(--surface-2)",
                opacity: a.disabledReason ? 0.6 : 1,
                cursor: a.disabledReason ? "default" : "pointer",
              }}
            >
              <input
                type="checkbox"
                name="addonIds"
                value={a.id}
                disabled={!!a.disabledReason}
                checked={!!selected[a.id]}
                onChange={(e) => setSelected((s) => ({ ...s, [a.id]: e.target.checked }))}
                style={{ marginTop: 4 }}
              />
              <span style={{ flex: 1 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{a.name}</strong>
                  <strong>
                    {yen(a.fee)}
                    {a.billingType === "monthly" ? "/月" : a.maxQuantity > 1 ? "/1件" : ""}
                  </strong>
                </span>
                {a.description && (
                  <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 2, lineHeight: 1.7 }}>
                    {a.description}
                  </span>
                )}
                {a.disabledReason && (
                  <span className="badge" style={{ display: "inline-block", marginTop: 4, fontSize: 11 }}>
                    {a.disabledReason}
                  </span>
                )}
                {a.maxQuantity > 1 && selected[a.id] && (
                  <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: 13 }}>
                    件数
                    <input
                      type="number"
                      name={`quantity_${a.id}`}
                      min={1}
                      max={a.maxQuantity}
                      value={qty[a.id] ?? 1}
                      onChange={(e) =>
                        setQty((q) => ({ ...q, [a.id]: Math.max(1, Math.min(a.maxQuantity, Number(e.target.value) || 1)) }))
                      }
                      style={{ width: 80 }}
                    />
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <form action={purchaseAddonAction} style={{ display: "grid", gap: 10 }}>
      {group("monthly", "月額のアドオン")}
      {group("one_time", "都度払いのアドオン")}

      <div style={{ marginTop: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>お支払い方法</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13.5 }}>
          {canUseCard && (
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" name="paymentMethod" value="card" checked={method === "card"} onChange={() => setMethod("card")} />
              クレジットカード
            </label>
          )}
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="radio"
              name="paymentMethod"
              value="bank_transfer"
              checked={method === "bank_transfer"}
              onChange={() => setMethod("bank_transfer")}
            />
            銀行振込（請求書）
          </label>
        </div>
      </div>

      <textarea name="note" rows={2} placeholder="運営への連絡事項・ご希望の日程など（任意）" style={{ fontSize: 13 }} />

      <div className="card" style={{ background: "var(--surface-2)", fontSize: 13.5, lineHeight: 1.8 }}>
        {monthlyTotal > 0 && <div>月額アドオン：{yen(monthlyTotal)}/月</div>}
        {oneTimeTotal > 0 && <div>都度払い：{yen(oneTimeTotal)}</div>}
        {!anySelected && <div className="muted">アドオンを選ぶと合計が表示されます。</div>}
        {anyMonthly && method === "card" && (
          <div className="muted" style={{ fontSize: 12 }}>
            ※カードの場合、月額アドオンはプラン料金と合わせてその場で決済し、契約期間を今日から1か月に更新します。
          </div>
        )}
        {anySelected && method === "bank_transfer" && (
          <div className="muted" style={{ fontSize: 12 }}>※請求書（PDF）をメールでお送りします。ご入金の確認後にご利用いただけます。</div>
        )}
      </div>

      <div>
        <PendingSubmitButton pendingLabel="処理中…（画面を閉じずにお待ちください）">選んだアドオンを申し込む</PendingSubmitButton>
      </div>
    </form>
  );
}

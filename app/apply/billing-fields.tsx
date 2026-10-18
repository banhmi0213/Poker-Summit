"use client";

import { useState } from "react";
import { CARD_BRANDS_NOTE } from "@/lib/constants";

// お支払い方法とお支払いサイクル。クレジットカードは毎月の自動決済のみなので、
// カードを選んだらサイクルは「毎月払い」に固定してグレーアウト(選べない)にする。
// 無効にした select は送信されないが、サーバー側は未指定なら毎月払い(1)として扱う。
export function ApplyBillingFields({
  cardEnabled,
  cycles,
}: {
  cardEnabled: boolean;
  cycles: { value: number; label: string }[];
}) {
  const [method, setMethod] = useState<"bank_transfer" | "card">("bank_transfer");
  const [cycle, setCycle] = useState("1");
  const isCard = method === "card";

  return (
    <>
      <div className="field">
        <span className="muted">お支払い方法</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input
              type="radio"
              name="billingMethod"
              value="bank_transfer"
              checked={method === "bank_transfer"}
              onChange={() => setMethod("bank_transfer")}
            />
            銀行振込（請求書払い）
          </label>
          {cardEnabled && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input type="radio" name="billingMethod" value="card" checked={isCard} onChange={() => setMethod("card")} />
              クレジットカード（毎月の自動決済）
            </label>
          )}
          {cardEnabled && CARD_BRANDS_NOTE && (
            <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              {CARD_BRANDS_NOTE}
            </span>
          )}
        </div>
      </div>
      <div className="field" style={isCard ? { opacity: 0.5 } : undefined}>
        <span className="muted">お支払いサイクル（銀行振込の場合）</span>
        <select
          name="billingCycle"
          value={isCard ? "1" : cycle}
          disabled={isCard}
          onChange={(e) => setCycle(e.target.value)}
          style={isCard ? { cursor: "not-allowed" } : undefined}
        >
          {cycles.map((c) => (
            <option key={c.value} value={String(c.value)}>
              {c.label}
            </option>
          ))}
        </select>
        {isCard && (
          <span className="muted" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
            クレジットカードは毎月払いのみです
          </span>
        )}
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_BRANDS_NOTE, CARD_SAVE_NOTE } from "@/lib/constants";

// お支払い方法とお支払いサイクル。2026/10/19〜 カードでもまとめ払い(6か月・12か月)を選べる
// (期間の終わりに同じサイクルで自動更新。更新の7日前にメールでお知らせ)。
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
  // ページの読み込み直後(画面の準備が終わる前)にカードを押すと、準備が終わった瞬間に
  // 「銀行振込」に戻ってしまい、カードを選んだつもりが振込で申し込まれることがあった(2026/10/19)。
  // ラジオボタンは画面側の選択をそのまま使い(defaultChecked)、準備が終わった時点の選択を読み取る。
  const cardRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (cardRef.current?.checked) setMethod("card");
  }, []);

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
              defaultChecked
              onChange={() => setMethod("bank_transfer")}
            />
            銀行振込（請求書払い）
          </label>
          {cardEnabled && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input ref={cardRef} type="radio" name="billingMethod" value="card" onChange={() => setMethod("card")} />
              クレジットカード（自動決済）
            </label>
          )}
          {cardEnabled && (
            <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              {CARD_BRANDS_NOTE}
              {isCard && <><br />{CARD_SAVE_NOTE}</>}
            </span>
          )}
        </div>
      </div>
      <div className="field">
        <span className="muted">お支払いサイクル</span>
        <select name="billingCycle" value={cycle} onChange={(e) => setCycle(e.target.value)}>
          {cycles.map((c) => (
            <option key={c.value} value={String(c.value)}>
              {c.label}
            </option>
          ))}
        </select>
        {isCard && cycle !== "1" && (
          <span className="muted" style={{ fontSize: 12, marginTop: 4, display: "block", lineHeight: 1.6 }}>
            お申し込み時に{cycle}か月分をカードでお支払いいただきます。期間の終わりに同じサイクルで自動更新します（更新の7日前にメールでお知らせします）。月額のアドオンは毎月別にお支払いいただきます。
          </span>
        )}
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBillingFailedThisMonth } from "@/lib/contracts";
import {
  updateContract,
  setContractStatus,
  recordManualBillingEvent,
} from "../actions";

function formatYen(value: number | null | undefined) {
  return `¥${(value ?? 0).toLocaleString("ja-JP")}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BILLING_EVENT_LABEL: Record<string, string> = {
  success: "成功",
  failed: "失敗",
  canceled: "解約",
};

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const [{ data: contract }, { data: plans }, { data: addons }, { data: billingEvents }] =
    await Promise.all([
      supabase
        .from("store_contracts")
        .select(
          "id, status, contact_name, contact_email, contact_tel, last_billing_status, last_billing_at, created_at, plan_id, stores(id, name, pref, region, tel, status), store_contract_addons(addon_id)"
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("plans").select("id, name, monthly_fee, active").order("sort_order"),
      supabase.from("addons").select("id, name, monthly_fee, active").order("sort_order"),
      supabase
        .from("billing_events")
        .select("id, event_type, amount, occurred_at, source, note")
        .eq("store_contract_id", params.id)
        .order("occurred_at", { ascending: false })
        .limit(20),
    ]);

  if (!contract) {
    notFound();
  }

  const selectedAddonIds = new Set((contract.store_contract_addons ?? []).map((a: any) => a.addon_id));
  const failed = isBillingFailedThisMonth({
    last_billing_status: contract.last_billing_status,
    last_billing_at: contract.last_billing_at,
  });

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{(contract.stores as any)?.name}</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {(contract.stores as any)?.pref}
            {(contract.stores as any)?.region ? ` ・ ${(contract.stores as any).region}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/admin/stores`} className="btn">
            店舗管理へ
          </Link>
          <Link href="/admin/contracts" className="btn">
            契約一覧に戻る
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <span className={`badge ${contract.status === "canceled" ? "outline" : ""}`}>
          {contract.status === "canceled" ? "解約済み" : "契約中"}
        </span>
        {failed && (
          <span style={{ color: "#d1453b", fontWeight: 700, fontSize: 13 }}>
            ⚠️ 今月引き落としに失敗しています
          </span>
        )}
        <form
          action={async () => {
            "use server";
            await setContractStatus(contract.id, contract.status === "canceled" ? "active" : "canceled");
          }}
        >
          <button type="submit" className="btn" style={{ fontSize: 12 }}>
            {contract.status === "canceled" ? "契約を再開する" : "解約にする"}
          </button>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>契約内容</h2>
          <form action={updateContract} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="contractId" value={contract.id} />
            <label>
              月額プラン
              <select name="planId" defaultValue={contract.plan_id ?? ""} required style={fieldStyle}>
                <option value="">選択してください</option>
                {(plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{formatYen(p.monthly_fee)}）{!p.active ? "（停止中）" : ""}
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
                      <input
                        type="checkbox"
                        name="addonIds"
                        value={a.id}
                        defaultChecked={selectedAddonIds.has(a.id)}
                      />
                      {a.name}（{formatYen(a.monthly_fee)}）{!a.active ? "（停止中）" : ""}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label>
              請求先担当者名
              <input type="text" name="contactName" defaultValue={contract.contact_name ?? ""} style={fieldStyle} />
            </label>
            <label>
              請求先メールアドレス
              <input type="email" name="contactEmail" defaultValue={contract.contact_email ?? ""} style={fieldStyle} />
            </label>
            <label>
              請求先電話番号
              <input type="tel" name="contactTel" defaultValue={contract.contact_tel ?? ""} style={fieldStyle} />
            </label>

            <button type="submit" className="btn primary" style={{ marginTop: 4 }}>
              保存する
            </button>
          </form>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>決済状況</h2>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            最終結果:{" "}
            {contract.last_billing_status === "success" && <span>正常（{formatDateTime(contract.last_billing_at)}）</span>}
            {contract.last_billing_status === "failed" && (
              <span style={{ color: "#d1453b", fontWeight: 700 }}>失敗（{formatDateTime(contract.last_billing_at)}）</span>
            )}
            {contract.last_billing_status === "unknown" && <span className="muted">未記録</span>}
          </p>

          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            カード決済は自動で記録されます。銀行振込以外で手動の対応をした場合などは、ここから記録してください。
          </p>

          <form
            action={recordManualBillingEvent}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}
          >
            <input type="hidden" name="contractId" value={contract.id} />
            <label style={{ flex: "1 1 120px" }}>
              結果
              <select name="eventType" required style={fieldStyle}>
                <option value="success">成功</option>
                <option value="failed">失敗</option>
              </select>
            </label>
            <label style={{ flex: "1 1 100px" }}>
              金額(円)
              <input type="number" name="amount" style={fieldStyle} />
            </label>
            <label style={{ flex: "2 1 160px" }}>
              メモ
              <input type="text" name="note" style={fieldStyle} />
            </label>
            <button type="submit" className="btn" style={{ height: 38 }}>
              記録する
            </button>
          </form>

          <h3 style={{ fontSize: 13, marginBottom: 8 }}>履歴</h3>
          {(!billingEvents || billingEvents.length === 0) && (
            <p className="muted" style={{ fontSize: 12.5 }}>記録された決済履歴はまだありません。</p>
          )}
          {billingEvents && billingEvents.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {billingEvents.map((ev) => (
                <div key={ev.id} style={{ fontSize: 12.5, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: ev.event_type === "failed" ? "#d1453b" : undefined,
                    }}
                  >
                    {BILLING_EVENT_LABEL[ev.event_type] ?? ev.event_type}
                  </span>
                  {" ・ "}
                  {formatDateTime(ev.occurred_at)}
                  {ev.amount != null ? ` ・ ${formatYen(ev.amount)}` : ""}
                  {" ・ "}
                  <span className="muted">{ev.source === "manual" ? "手動" : ev.source === "card_renewal" ? "自動更新" : ev.source === "contract_change" ? "変更・購入" : ev.source === "bank_transfer" ? "振込" : "自動"}</span>
                  {ev.note ? <div className="muted">{ev.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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

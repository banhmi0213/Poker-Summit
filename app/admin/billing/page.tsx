import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  BILLING_CYCLES,
  cycleLabel,
  discountFor,
  formatJpDate,
  getBillingSettings,
  isOverdue,
  isoToJstDate,
  todayJst,
  type InvoiceRow,
} from "@/lib/bank-transfer";
import {
  cancelInvoiceAction,
  confirmPaymentAction,
  issueInvoiceAction,
  resendInvoiceAction,
  updateBillingSettingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "unpaid", label: "未入金" },
  { key: "paid", label: "入金済み" },
  { key: "canceled", label: "取消・失効" },
  { key: "all", label: "すべて" },
  { key: "settings", label: "振込・請求の設定" },
];

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

// 総合管理「入金管理」(2026/10、銀行振込の導入で新設)。
// 請求書の一覧・入金確認・取消・再送、契約中の店舗への請求書の発行、振込先などの設定。
// 管理画面のレイアウト(app/admin/layout.tsx)で運営かどうかを確認済み。
// 書き込みはすべて actions.ts 側で運営確認してから service-role で行う。
export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: { tab?: string; ok?: string; error?: string; q?: string };
}) {
  const tab = STATUS_TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "unpaid";
  const svc = createServiceRoleClient();
  const settings = await getBillingSettings(svc);
  const today = todayJst();
  const q = searchParams.q?.trim() ?? "";

  let invoices: InvoiceRow[] = [];
  if (tab !== "settings") {
    let query = svc.from("invoices").select("*").order("issued_at", { ascending: false }).limit(200);
    if (tab !== "all") query = query.eq("status", tab);
    if (q) query = query.or(`bill_to_name.ilike.%${q.replace(/[%,()]/g, "")}%,invoice_number.ilike.%${q.replace(/[%,()]/g, "")}%`);
    const { data } = await query;
    invoices = (data ?? []) as InvoiceRow[];
    if (tab === "unpaid") invoices.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }

  const [{ count: unpaidCount }, { count: overdueCount }, { data: contracts }, { data: plans }] = await Promise.all([
    svc.from("invoices").select("id", { count: "exact", head: true }).eq("status", "unpaid"),
    svc.from("invoices").select("id", { count: "exact", head: true }).eq("status", "unpaid").lt("due_date", today),
    svc
      .from("store_contracts")
      .select("id, billing_method, billing_cycle_months, current_period_end, contact_email, stores(name, status)")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    svc.from("plans").select("id, name, monthly_fee, active").order("sort_order"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>入金管理</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
        銀行振込の請求書と入金確認。入金を確認したら「入金確認」を押すと、新規申込みは店舗・ログインを発行、
        更新は契約期間を延長し、未入金で非公開にしていた店舗ページは公開に戻ります。
        期限前日のリマインド・期限翌日の非公開・次回請求書の発行（契約終了の7日前）は毎日自動で行います。
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="muted" style={{ fontSize: 12 }}>未入金</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{unpaidCount ?? 0}件</div>
        </div>
        <div className="card" style={{ minWidth: 160, borderColor: (overdueCount ?? 0) > 0 ? "#d1453b" : undefined }}>
          <div className="muted" style={{ fontSize: 12 }}>期限超過</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: (overdueCount ?? 0) > 0 ? "#d1453b" : undefined }}>
            {overdueCount ?? 0}件
          </div>
        </div>
      </div>

      {searchParams.ok && <p className="ok" style={{ color: "#2e7d32", marginBottom: 12 }}>✅ {searchParams.ok}</p>}
      {searchParams.error && <p className="err">{searchParams.error}</p>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUS_TABS.map((t) => (
          <Link key={t.key} href={`/admin/billing?tab=${t.key}`} className={`btn${t.key === tab ? " primary" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "settings" ? (
        <SettingsForm settings={settings} />
      ) : (
        <>
          <form method="get" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="hidden" name="tab" value={tab} />
            <input type="text" name="q" defaultValue={q} placeholder="店舗名・請求書番号で検索" style={{ maxWidth: 280 }} />
            <button className="btn" type="submit">検索</button>
          </form>

          {invoices.length === 0 ? (
            <div className="card muted">該当する請求書はありません。</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {invoices.map((inv) => {
                const overdue = isOverdue(inv, today);
                const isNewApplication = !!inv.listing_application_id && !inv.store_contract_id;
                return (
                  <div
                    key={inv.id}
                    className="card"
                    style={{ borderColor: overdue ? "#d1453b" : undefined, background: overdue ? "rgba(209,69,59,0.05)" : undefined }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>
                          {inv.bill_to_name}
                          <span className="badge" style={{ marginLeft: 8, fontSize: 10.5 }}>
                            {inv.kind === "addon" ? "アドオン" : isNewApplication ? "新規申込み" : "契約更新・変更"}
                          </span>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {inv.invoice_number}・{inv.plan_name}{inv.kind === "addon" ? "" : `・${cycleLabel(inv.months, inv.discount_label)}`}
                          {inv.bill_to_contact ? `・ご担当 ${inv.bill_to_contact}` : ""}・{inv.bill_to_email}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          発行 {formatJpDate(isoToJstDate(inv.issued_at))}
                          {inv.period_start ? `・期間 ${formatJpDate(inv.period_start)}〜${inv.period_end ? formatJpDate(inv.period_end) : ""}` : "・期間は入金確認日から"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{yen(inv.total_amount)}</div>
                        <div style={{ fontSize: 12.5, color: overdue ? "#d1453b" : undefined, fontWeight: overdue ? 700 : 400 }}>
                          {inv.status === "paid"
                            ? `入金確認 ${inv.paid_at ? formatJpDate(isoToJstDate(inv.paid_at)) : ""}`
                            : inv.status === "canceled"
                              ? "取消・失効"
                              : `期限 ${formatJpDate(inv.due_date)}${overdue ? "（期限超過）" : ""}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                      <a className="btn" href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                      {inv.status === "unpaid" && (
                        <>
                          <form action={confirmPaymentAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input type="text" name="note" placeholder="メモ（振込名義など・任意）" style={{ width: 200 }} />
                            <button type="submit" className="btn primary">
                              入金確認
                            </button>
                          </form>
                          <form action={resendInvoiceAction}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <button type="submit" className="btn">
                              メール再送
                            </button>
                          </form>
                          <form action={cancelInvoiceAction}>
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <button type="submit" className="btn" style={{ color: "#d1453b" }}>
                              取消
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>契約中の店舗に請求書を発行</h2>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px", lineHeight: 1.7 }}>
              プラン変更・まとめ払いへの切替・カード払いからの切替などに。入金確認でその契約のプラン・支払いサイクル・期間が請求書の内容に切り替わります。
              次回分の請求書は自動でも発行されます（銀行振込の契約のみ）。
            </p>
            <form action={issueInvoiceAction} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
              <select name="contractId" required defaultValue="">
                <option value="" disabled>
                  契約店舗を選択
                </option>
                {(contracts ?? []).map((c: any) => {
                  const store = Array.isArray(c.stores) ? c.stores[0] : c.stores;
                  return (
                    <option key={c.id} value={c.id}>
                      {store?.name ?? "（店舗名なし）"}（{c.billing_method === "bank_transfer" ? `振込・${cycleLabel(c.billing_cycle_months)}` : "カード"}
                      {c.current_period_end ? `・〜${new Date(c.current_period_end).toLocaleDateString("ja-JP")}` : ""}
                      {c.contact_email ? "" : "・メール未登録"}）
                    </option>
                  );
                })}
              </select>
              <select name="planId" required defaultValue="">
                <option value="" disabled>
                  プランを選択
                </option>
                {(plans ?? [])
                  .filter((p: any) => p.active)
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}（月額{yen(p.monthly_fee)}）
                    </option>
                  ))}
              </select>
              <select name="months" defaultValue="1">
                {BILLING_CYCLES.map((m) => {
                  const d = discountFor(settings, m);
                  return (
                    <option key={m} value={m}>
                      {cycleLabel(m, d ? (d.type === "percent" ? `${d.value}%OFF` : `${d.value}か月分無料`) : null)}
                    </option>
                  );
                })}
              </select>
              <select name="startMode" defaultValue="next">
                <option value="next">今の契約期間の終了日から（更新・期間満了での切替）</option>
                <option value="today">今日から（すぐ切り替える）</option>
              </select>
              <button type="submit" className="btn primary">
                請求書を発行してメール送信
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function SettingsForm({ settings }: { settings: Awaited<ReturnType<typeof getBillingSettings>> }) {
  const bank = settings.bank;
  const d6 = settings.discounts?.["6"] ?? null;
  const d12 = settings.discounts?.["12"] ?? null;
  return (
    <form action={updateBillingSettingsAction} className="card" style={{ display: "grid", gap: 10, maxWidth: 560 }}>
      <h2 style={{ fontSize: 16, margin: 0 }}>振込先</h2>
      <label className="field">
        <span className="muted">金融機関</span>
        <input name="bank" defaultValue={bank?.bank ?? ""} required />
      </label>
      <label className="field">
        <span className="muted">支店</span>
        <input name="branch" defaultValue={bank?.branch ?? ""} required />
      </label>
      <label className="field">
        <span className="muted">口座種別</span>
        <input name="accountType" defaultValue={bank?.type ?? "普通"} />
      </label>
      <label className="field">
        <span className="muted">口座番号</span>
        <input name="number" defaultValue={bank?.number ?? ""} required />
      </label>
      <label className="field">
        <span className="muted">口座名義（カナ）</span>
        <input name="holder" defaultValue={bank?.holder ?? ""} required />
      </label>

      <h2 style={{ fontSize: 16, margin: "8px 0 0" }}>請求書</h2>
      <label className="field">
        <span className="muted">インボイス登録番号</span>
        <input name="registrationNumber" defaultValue={settings.registrationNumber ?? ""} placeholder="T0000000000000" />
      </label>
      <label className="field">
        <span className="muted">支払期限（請求書の発行から何日）</span>
        <input name="dueDays" type="number" min={1} max={60} defaultValue={settings.dueDays} />
      </label>

      <h2 style={{ fontSize: 16, margin: "8px 0 0" }}>まとめ払いの割引</h2>
      {(
        [
          ["6", d6],
          ["12", d12],
        ] as const
      ).map(([m, d]) => (
        <div key={m} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ width: 110 }}>{m}か月まとめ払い</span>
          <select name={`discount${m}Type`} defaultValue={d?.type ?? "none"} style={{ width: 150 }}>
            <option value="none">割引なし</option>
            <option value="percent">％OFF</option>
            <option value="free_months">か月分無料</option>
          </select>
          <input name={`discount${m}Value`} type="number" min={0} step="1" defaultValue={d?.value ?? ""} style={{ width: 90 }} />
        </div>
      ))}

      <h2 style={{ fontSize: 16, margin: "8px 0 0" }}>クレジットカード</h2>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="cardPaymentEnabled" defaultChecked={settings.cardPaymentEnabled} />
        掲載申込みでクレジットカード払いを選べるようにする
      </label>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        カード決済会社の審査が通るまではオフにしておくと、申込みは銀行振込だけになります。
      </p>

      <button type="submit" className="btn primary" style={{ marginTop: 8 }}>
        保存する
      </button>
    </form>
  );
}

import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ORDER_STATUS_LABEL } from "@/lib/addons";
import { updateAddonOrderAction } from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "open", label: "対応待ち・対応中" },
  { key: "awaiting_payment", label: "入金待ち" },
  { key: "completed", label: "完了" },
  { key: "canceled", label: "取消" },
  { key: "all", label: "すべて" },
];

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

// 総合管理「アドオン注文」(2026/10)。店舗が申し込んだアドオンの一覧と対応状況。
// 記事・動画・撮影・TOPバナーなど運営の対応が必要なものは、ここで「対応中」「完了」に更新する。
// 振込の入金確認は「入金管理」で行う(確認すると自動でここも「お支払い済み」になる)。
export default async function AdminAddonOrdersPage({
  searchParams,
}: {
  searchParams: { tab?: string; ok?: string; error?: string };
}) {
  const tab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "open";
  const svc = createServiceRoleClient();
  let query = svc
    .from("addon_orders")
    .select("*, stores(name, pref)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tab === "open") query = query.in("status", ["paid", "in_progress"]);
  else if (tab !== "all") query = query.eq("status", tab);
  const { data: orders } = await query;

  const { data: active } = await svc
    .from("store_contract_addons")
    .select("id, billing_method, current_period_end, pending_removed_at, fee, addons(name), store_contracts!inner(status, stores(name, pref))")
    .eq("store_contracts.status", "active");

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>アドオン注文</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.7 }}>
        店舗が申し込んだアドオンの一覧です。記事・動画・撮影・TOPバナーなど運営の対応が必要なものは、状況を更新してください。
        銀行振込の入金確認は<Link href="/admin/billing" style={{ textDecoration: "underline" }}>入金管理</Link>で行います。
        料金・枠数の変更は<Link href="/admin/contracts/plans" style={{ textDecoration: "underline" }}>プラン・アドオン設定</Link>から。
      </p>
      {searchParams.ok && <p style={{ color: "#2e7d32" }}>✅ {searchParams.ok}</p>}
      {searchParams.error && <p className="err">{searchParams.error}</p>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/addon-orders?tab=${t.key}`} className={`btn${t.key === tab ? " primary" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {(orders ?? []).length === 0 ? (
        <div className="card muted">該当する注文はありません。</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(orders ?? []).map((o: any) => {
            const store = Array.isArray(o.stores) ? o.stores[0] : o.stores;
            return (
              <div key={o.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <strong>{o.addon_name}</strong>
                    {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                    <span className="badge" style={{ marginLeft: 8, fontSize: 10.5 }}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {store?.name ?? "（店舗）"}（{store?.pref ?? "-"}）・{new Date(o.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </div>
                    {o.note && <div style={{ fontSize: 12.5, marginTop: 4 }}>店舗から：{o.note}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{yen(o.total_amount)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{o.payment_method === "card" ? "カード" : "銀行振込"}</div>
                    {o.invoice_id && (
                      <a href={`/api/invoices/${o.invoice_id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "underline" }}>
                        請求書
                      </a>
                    )}
                  </div>
                </div>
                <form action={updateAddonOrderAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <select name="status" defaultValue={o.status === "awaiting_payment" ? "" : o.status} style={{ width: 170 }}>
                    <option value="" disabled>状態を選択</option>
                    <option value="paid">お支払い済み・対応待ち</option>
                    <option value="in_progress">対応中</option>
                    <option value="completed">完了</option>
                    <option value="canceled">取消</option>
                  </select>
                  <input type="text" name="adminNote" defaultValue={o.admin_note ?? ""} placeholder="運営メモ" style={{ flex: 1, minWidth: 200 }} />
                  <button className="btn" type="submit">更新</button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ fontSize: 16, margin: "24px 0 8px" }}>契約中の月額アドオン</h2>
      {(active ?? []).length === 0 ? (
        <div className="card muted">ありません。</div>
      ) : (
        <div className="card" style={{ display: "grid", gap: 6, fontSize: 13 }}>
          {(active ?? []).map((r: any) => {
            const c = Array.isArray(r.store_contracts) ? r.store_contracts[0] : r.store_contracts;
            const s = Array.isArray(c?.stores) ? c.stores[0] : c?.stores;
            const a = Array.isArray(r.addons) ? r.addons[0] : r.addons;
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span>
                  {a?.name}　<span className="muted">{s?.name}（{s?.pref ?? "-"}）</span>
                </span>
                <span className="muted">
                  {r.fee != null ? `${yen(r.fee)}/月・` : ""}
                  {r.billing_method === "bank_transfer" ? `振込・〜${r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("ja-JP") : "-"}` : "カード"}
                  {r.pending_removed_at ? `・${new Date(r.pending_removed_at).toLocaleDateString("ja-JP")}に解約` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

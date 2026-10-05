import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isBillingFailedThisMonth } from "@/lib/contracts";

const STATUS_LABEL: Record<string, string> = {
  active: "契約中",
  canceled: "解約済み",
};

// 店舗が自分で行ったプラン・アドオン変更(lib/contracts-billing.ts)の
// 状態ラベル。運営の承認操作は廃止し、ここは閲覧専用の監査ログになった
// (2026/10)。
const CHANGE_STATUS_LABEL: Record<string, string> = {
  completed: "✅ 決済完了・反映済み",
  failed: "❌ 決済失敗",
  pending: "⏳ 期間終了時に予約中",
  canceled: "予約取消",
};

function formatYen(value: number | null | undefined) {
  return `¥${(value ?? 0).toLocaleString("ja-JP")}`;
}

// 契約店舗一覧 — is_recommended(PICK UP表示)や掲載ステータスとは別の、
// 「課金契約」を結んでいる店舗だけの一覧。店舗そのものは /admin/stores で
// 管理し、こちらは月額プラン・アドオン・決済状況・解約有無を管理する。
export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const supabase = await createClient();
  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "all";

  // store_contracts から plans への外部キーは plan_id と pending_plan_id の
  // 2本あるため、plans(...) だけだと PostgREST がどちらで結合するか決められず
  // エラー(PGRST201、HTTP 300)になる。現在のプラン(plan_id)側の外部キーを
  // 明示する。店舗側のプラン画面(/store/profile/plan)も同じ理由で明示している。
  let query = supabase
    .from("store_contracts")
    .select(
      "id, status, contact_name, contact_email, contact_tel, last_billing_status, last_billing_at, current_period_end, pending_plan_id, pending_plan_effective_at, created_at, stores!inner(id, name, pref, region, tel), plans!store_contracts_plan_id_fkey(name, monthly_fee), store_contract_addons(addon_id)"
    )
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.ilike("stores.name", `%${q}%`);
  }

  const { data: contracts, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const failingNow = (contracts ?? []).filter((c: any) =>
    isBillingFailedThisMonth({ last_billing_status: c.last_billing_status, last_billing_at: c.last_billing_at })
  );

  // 店舗オーナーが/store/profile/plan(PC)やLINEリッチメニューから自分で
  // 行ったプラン・アドオン変更の履歴(2026/10、カード決済組み込みにより
  // 運営の事前承認は不要になった。ここは「店舗が何を変更し、決済が完了
  // したか」を運営が把握するための閲覧専用ログ)。直近50件まで表示する。
  const [{ data: planRequests }, { data: addonRequests }, { data: allAddonsForNames }] = await Promise.all([
    supabase
      .from("plan_change_requests")
      .select(
        "id, note, status, payment_status, charged_amount, review_note, requested_at, stores(name), current_plan:current_plan_id(name), requested_plan:requested_plan_id(name, monthly_fee)"
      )
      .order("requested_at", { ascending: false })
      .limit(50),
    supabase
      .from("addon_change_requests")
      .select("id, note, status, payment_status, charged_amount, review_note, requested_at, requested_addon_ids, stores(name)")
      .order("requested_at", { ascending: false })
      .limit(50),
    supabase.from("addons").select("id, name"),
  ]);
  const addonNameById = new Map((allAddonsForNames ?? []).map((a) => [a.id, a.name]));

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22 }}>契約店舗一覧</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/contracts/pickup" className="btn">
            都道府県別PICK UP契約
          </Link>
          <Link href="/admin/contracts/plans" className="btn">
            プラン・アドオン管理
          </Link>
          <Link href="/admin/contracts/new" className="btn primary">
            契約を登録
          </Link>
        </div>
      </div>

      {failingNow.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderColor: "#d1453b",
            background: "rgba(209, 69, 59, 0.08)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#d1453b", marginBottom: 6 }}>
            ⚠️ 今月引き落としに失敗している店舗が{failingNow.length}件あります
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {failingNow.map((c: any) => (
              <Link
                key={c.id}
                href={`/admin/contracts/${c.id}`}
                style={{ fontSize: 13, color: "#d1453b", fontWeight: 700 }}
              >
                {c.stores?.name} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {planRequests && planRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            📒 プラン変更ログ(店舗管理画面・LINEリッチメニューから、店舗が自分でカード決済・直近{planRequests.length}件)
          </div>
          <table>
            <thead>
              <tr>
                <th>店舗名</th>
                <th>変更前プラン</th>
                <th>変更後プラン</th>
                <th>状態</th>
                <th>決済金額</th>
                <th>連絡事項</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {planRequests.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.stores?.name}</td>
                  <td>{r.current_plan?.name ?? "未設定"}</td>
                  <td>
                    {r.requested_plan?.name}
                    {r.requested_plan?.monthly_fee != null
                      ? `（${formatYen(r.requested_plan.monthly_fee)}）`
                      : ""}
                  </td>
                  <td>
                    {CHANGE_STATUS_LABEL[r.status] ?? r.status}
                    {r.status === "failed" && r.review_note && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {r.review_note}
                      </div>
                    )}
                  </td>
                  <td>{r.charged_amount != null ? formatYen(r.charged_amount) : "-"}</td>
                  <td style={{ maxWidth: 200 }}>{r.note || "-"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {new Date(r.requested_at).toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addonRequests && addonRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            📒 アドオン変更ログ(店舗管理画面から、店舗が自分でカード決済・直近{addonRequests.length}件)
          </div>
          <table>
            <thead>
              <tr>
                <th>店舗名</th>
                <th>変更後のアドオン構成</th>
                <th>状態</th>
                <th>決済金額</th>
                <th>連絡事項</th>
                <th>日時</th>
              </tr>
            </thead>
            <tbody>
              {addonRequests.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.stores?.name}</td>
                  <td>
                    {(r.requested_addon_ids ?? []).length > 0
                      ? (r.requested_addon_ids as string[])
                          .map((id) => addonNameById.get(id) ?? id)
                          .join("、")
                      : "なし（全解除）"}
                  </td>
                  <td>
                    {CHANGE_STATUS_LABEL[r.status] ?? r.status}
                    {r.status === "failed" && r.review_note && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {r.review_note}
                      </div>
                    )}
                  </td>
                  <td>{r.charged_amount != null ? formatYen(r.charged_amount) : "-"}</td>
                  <td style={{ maxWidth: 200 }}>{r.note || "-"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {new Date(r.requested_at).toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="店舗名で検索"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
            width: 220,
          }}
        />
        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-2)",
            fontSize: 13,
          }}
        >
          <option value="all">ステータス: すべて</option>
          <option value="active">契約中</option>
          <option value="canceled">解約済み</option>
        </select>
        <button type="submit" className="btn">
          検索
        </button>
      </form>

      {(!contracts || contracts.length === 0) && (
        <p className="muted">契約店舗はまだ登録されていません。</p>
      )}

      {contracts && contracts.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>店舗名</th>
              <th>地域</th>
              <th>連絡先</th>
              <th>月額プラン</th>
              <th>アドオン</th>
              <th>契約期間・予約</th>
              <th>決済状況</th>
              <th>契約ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c: any) => {
              const failed = isBillingFailedThisMonth({
                last_billing_status: c.last_billing_status,
                last_billing_at: c.last_billing_at,
              });
              const addonCount = c.store_contract_addons?.length ?? 0;
              return (
                <tr key={c.id}>
                  <td>{c.stores?.name}</td>
                  <td>
                    {c.stores?.pref}
                    {c.stores?.region ? <div className="muted" style={{ fontSize: 11 }}>{c.stores.region}</div> : null}
                  </td>
                  <td>
                    <div>{c.contact_name || c.stores?.tel || "-"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.contact_email}
                      {c.contact_email && c.contact_tel ? " ・ " : ""}
                      {c.contact_tel}
                    </div>
                  </td>
                  <td>{c.plans ? `${c.plans.name}（${formatYen(c.plans.monthly_fee)}）` : "未設定"}</td>
                  <td>{addonCount > 0 ? `あり（${addonCount}件）` : "なし"}</td>
                  <td>
                    {c.current_period_end ? (
                      <div style={{ fontSize: 12 }}>〜{new Date(c.current_period_end).toLocaleDateString("ja-JP")}</div>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>未記録</span>
                    )}
                    {c.pending_plan_id && c.pending_plan_effective_at && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        ⏳ {new Date(c.pending_plan_effective_at).toLocaleDateString("ja-JP")}にプラン変更予約あり
                      </div>
                    )}
                  </td>
                  <td>
                    {failed ? (
                      <span style={{ color: "#d1453b", fontWeight: 700 }}>⚠️ 今月失敗</span>
                    ) : c.last_billing_status === "success" ? (
                      <span className="muted">正常</span>
                    ) : (
                      <span className="muted">未記録</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.status === "canceled" ? "outline" : ""}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/admin/contracts/${c.id}`} className="btn" style={{ fontSize: 12 }}>
                      詳細
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createContract } from "../actions";

function formatYen(value: number | null | undefined) {
  return `¥${(value ?? 0).toLocaleString("ja-JP")}`;
}

export default async function NewContractPage() {
  const supabase = await createClient();

  const [{ data: stores }, { data: existingContracts }, { data: plans }, { data: addons }] =
    await Promise.all([
      supabase
        .from("stores")
        .select("id, name, pref")
        .in("status", ["approved", "listed"])
        .order("name", { ascending: true }),
      supabase.from("store_contracts").select("store_id"),
      supabase.from("plans").select("id, name, monthly_fee").eq("active", true).order("sort_order"),
      // 契約に付けるのは毎月払いのアドオンだけ(買い切りは店舗が「プラン・お支払い」から都度買う。2026/10/20)
      supabase.from("addons").select("id, name, monthly_fee").eq("active", true).eq("billing_type", "monthly").order("sort_order"),
    ]);

  const contractedStoreIds = new Set((existingContracts ?? []).map((c) => c.store_id));
  const availableStores = (stores ?? []).filter((s) => !contractedStoreIds.has(s.id));

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22 }}>契約を登録</h1>
        <Link href="/admin/contracts" className="btn">
          一覧に戻る
        </Link>
      </div>

      {availableStores.length === 0 ? (
        <p className="muted">
          未契約の掲載店舗がありません。先に{" "}
          <Link href="/admin/stores">店舗管理</Link> で店舗を掲載してください。
        </p>
      ) : (!plans || plans.length === 0) ? (
        <p className="muted">
          有効なプランがありません。先に{" "}
          <Link href="/admin/contracts/plans">プラン・アドオン管理</Link> でプランを登録してください。
        </p>
      ) : (
        <form action={createContract} className="card" style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            店舗
            <select name="storeId" required style={fieldStyle}>
              <option value="">選択してください</option>
              {availableStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.name}${s.pref ? `（${s.pref}）` : ""}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            月額プラン
            <select name="planId" required style={fieldStyle}>
              <option value="">選択してください</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.name}（${formatYen(p.monthly_fee)}）`}
                </option>
              ))}
            </select>
          </label>

          <label>
            無料期間（月額プランのみ）
            <select name="trialMonths" defaultValue="0" style={fieldStyle}>
              <option value="0">なし</option>
              <option value="1">1か月無料</option>
              <option value="2">2か月無料</option>
              <option value="3">3か月無料</option>
            </select>
            <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4, fontWeight: 400, lineHeight: 1.7 }}>
              知り合いの店などに。無料期間の終わる7日前に店舗と運営へお知らせします。店舗がカードを登録していれば、終わった日に自動で決済して続きます。
              登録がなければ、契約の画面で「振込で続ける」か「終了する」を選んでください（決まるまでは無料のまま使えます）。
            </span>
          </label>

          {addons && addons.length > 0 && (
            <div>
              <div style={{ marginBottom: 6 }}>アドオン</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {addons.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                    <input type="checkbox" name="addonIds" value={a.id} />
                    {a.name}（{formatYen(a.monthly_fee)}）
                  </label>
                ))}
              </div>
            </div>
          )}

          <label>
            請求先担当者名
            <input type="text" name="contactName" style={fieldStyle} />
          </label>
          <label>
            請求先メールアドレス
            <input type="email" name="contactEmail" style={fieldStyle} />
          </label>
          <label>
            請求先電話番号
            <input type="tel" name="contactTel" style={fieldStyle} />
          </label>

          {/* 事業者の確認(本人確認・反社会的勢力のチェック、2026/10/21)。手で作る契約も確認してから */}
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.6 }}>
            <input type="checkbox" name="kycConfirmed" required style={{ marginTop: 3, flexShrink: 0 }} />
            <span>この事業者の確認（法人番号の照合または代表者の本人確認、公開情報での反社会的勢力との関係の確認）を済ませ、反社会的勢力に該当しないことの表明・確約を受けた</span>
          </label>
          <label>
            確認メモ（照合した法人番号・確認した書類など）
            <textarea name="kycNote" rows={2} style={fieldStyle} />
          </label>

          <button type="submit" className="btn primary" style={{ marginTop: 4 }}>
            登録する
          </button>
        </form>
      )}
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

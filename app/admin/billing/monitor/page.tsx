import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveAttemptAction, provisionApplicationAction } from "./actions";
import { komojuKeyMode } from "@/lib/komoju";

export const dynamic = "force-dynamic";

// 総合管理「入金管理 > 決済の監視」(2026/10/18)。
// - 結果が確認できていないカード決済(二重請求を防ぐため自動の再決済を止めているもの)
// - 決済済みなのに店舗の発行が止まっている新規申込み
// - 最近のカード決済の記録
// - 毎日の自動処理(カード更新・振込の請求)の実行結果
// 確認が必要なものが出たときは、運営の通知先メールアドレスにもメールが届く。

const PURPOSE_LABEL: Record<string, string> = {
  apply: "新規申込み",
  renewal: "契約更新",
  change: "プラン・アドオン変更",
  upgrade: "プラン変更(日割り)",
  addon_renewal: "アドオン更新",
  addon_purchase: "アドオン購入",
};
const STATUS_LABEL: Record<string, string> = { pending: "処理中", captured: "決済済み", failed: "失敗", unknown: "結果不明" };
const JOB_LABEL: Record<string, string> = { "card-billing": "カード決済・契約更新（毎日 午前3時）", "bank-transfer": "振込の請求・入金確認（毎日 午前9時）", "member-digest": "新規会員のまとめメール（毎日 午前9時）", "payment-sessions": "カード支払い画面の結果確認（10分ごと）" };

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const jst = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default async function BillingMonitorPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const svc = createServiceRoleClient();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [{ data: open }, { data: recent }, { data: stuckApps }, { data: runs }] = await Promise.all([
    svc.from("payment_attempts").select("*").or(`status.eq.unknown,and(status.eq.pending,created_at.lt.${staleBefore})`).order("created_at", { ascending: false }),
    svc.from("payment_attempts").select("*").order("created_at", { ascending: false }).limit(30),
    svc
      .from("listing_applications")
      .select("id, company_name, email, payment_status, payment_note, created_at")
      .in("payment_status", ["charge_unknown", "charged_pending_manual"])
      .order("created_at", { ascending: false }),
    svc.from("cron_runs").select("*").order("started_at", { ascending: false }).limit(20),
  ]);
  // KOMOJUの支払い画面でお客様が操作中のもの(初回の申込み)は、24時間までは確認待ちに出さない(自動処理が確かめる)
  const openList = ((open ?? []) as any[]).filter((a) => !(a.status === "pending" && a.context?.hosted && Date.now() - Date.parse(a.created_at) < 24 * 3600 * 1000));
  const apps = (stuckApps ?? []) as any[];

  return (
    <div>
      <Link href="/admin/billing" className="btn" style={{ marginBottom: 12, display: "inline-flex" }}>
        ← 入金管理に戻る
      </Link>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>決済の監視</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
        カード決済の結果が分からないときは、二重請求を防ぐため自動での再決済を止めて、ここに表示します（運営にもメールが届きます）。
        「KOMOJUで確認する」を押すと、KOMOJUに決済があるかを確かめて、決済済みなら続きの処理（期間の延長・店舗の発行など）を行います。新たに決済はしません。
      </p>

      {(() => {
        // いま本番サイトが使っているKOMOJUのキーの種類(キーそのものは出さない)
        const mode = komojuKeyMode();
        const label = { live: "本番（Live）", test: "テスト", missing: "未設定", unknown: "判別できません" }[mode];
        return (
          <div className="card" style={{ marginBottom: 14, borderColor: mode === "live" ? undefined : "#d1453b" }}>
            <strong>KOMOJUの接続先：{label}</strong>
            {mode !== "live" && (
              <p className="muted small" style={{ marginTop: 4 }}>
                本番のカード決済には本番（Live）のキーが必要です。Vercelの環境変数 KOMOJU_SECRET_KEY を確認し、変えたあとはデプロイし直してください（デプロイするまで反映されません）。
              </p>
            )}
          </div>
        );
      })()}

      {searchParams.ok && <p style={{ color: "#2e7d32", marginBottom: 12 }}>✅ {searchParams.ok}</p>}
      {searchParams.error && <p className="err">{searchParams.error}</p>}

      <h2 style={{ fontSize: 16, margin: "18px 0 8px" }}>確認が必要な決済（{openList.length}件）</h2>
      {openList.length === 0 ? (
        <p className="muted small">ありません。</p>
      ) : (
        openList.map((a) => (
          <div key={a.id} className="card" style={{ marginBottom: 10, borderColor: "#d1453b" }}>
            <div style={{ fontWeight: 700 }}>{a.context?.description ?? PURPOSE_LABEL[a.purpose] ?? a.purpose}</div>
            <div className="muted small" style={{ lineHeight: 1.7 }}>
              {PURPOSE_LABEL[a.purpose] ?? a.purpose} ・ {yen(a.amount)} ・ {STATUS_LABEL[a.status] ?? a.status} ・ {jst(a.created_at)}
              <br />
              注文番号: {a.idem_key}
              {a.error ? (
                <>
                  <br />
                  内容: {a.error}
                </>
              ) : null}
            </div>
            <form action={resolveAttemptAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="attemptId" value={a.id} />
              <button type="submit" className="btn primary">
                KOMOJUで確認する
              </button>
            </form>
          </div>
        ))
      )}

      <h2 style={{ fontSize: 16, margin: "18px 0 8px" }}>店舗の発行が止まっている新規申込み（{apps.length}件）</h2>
      {apps.length === 0 ? (
        <p className="muted small">ありません。</p>
      ) : (
        apps.map((a) => (
          <div key={a.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>{a.company_name}</div>
            <div className="muted small" style={{ lineHeight: 1.7 }}>
              {a.email} ・ {jst(a.created_at)}
              <br />
              {a.payment_status === "charge_unknown" ? "決済の結果確認待ち（上の「確認が必要な決済」から確認してください）" : "決済済み・店舗の発行でエラー"}
              {a.payment_note ? (
                <>
                  <br />
                  {a.payment_note}
                </>
              ) : null}
            </div>
            {a.payment_status === "charged_pending_manual" && (
              <form action={provisionApplicationAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="applicationId" value={a.id} />
                <button type="submit" className="btn primary">
                  店舗を発行する
                </button>
              </form>
            )}
          </div>
        ))
      )}

      <h2 style={{ fontSize: 16, margin: "18px 0 8px" }}>自動処理の実行結果</h2>
      {(runs ?? []).length === 0 ? (
        <p className="muted small">まだ記録がありません。</p>
      ) : (
        (runs ?? []).map((r: any) => (
          <details key={r.id} className="card" style={{ marginBottom: 8, borderColor: r.ok === false ? "#d1453b" : undefined }}>
            <summary style={{ cursor: "pointer" }}>
              <strong>{r.ok === null ? "⏳ 実行中/途中で停止" : r.ok ? "✅ 正常" : `⚠️ ${r.failures}件 要確認`}</strong> ・ {JOB_LABEL[r.job] ?? r.job} ・ {jst(r.started_at)}
            </summary>
            <div className="muted small" style={{ marginTop: 8, lineHeight: 1.7, overflowWrap: "anywhere" }}>
              {Object.entries(r.summary ?? {})
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(" ・ ") || "—"}
              {(r.errors ?? []).map((f: any, i: number) => (
                <div key={i}>
                  ・{f.step}
                  {f.id ? `（${f.id}）` : ""}: {f.detail}
                </div>
              ))}
            </div>
          </details>
        ))
      )}

      <h2 style={{ fontSize: 16, margin: "18px 0 8px" }}>最近のカード決済</h2>
      {(recent ?? []).length === 0 ? (
        <p className="muted small">まだ記録がありません。</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {(recent ?? []).map((a: any) => (
            <div key={a.id} className="card" style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700 }}>
                  {STATUS_LABEL[a.status] ?? a.status} ・ {yen(a.amount)}
                </span>
                <span className="muted small">{jst(a.created_at)}</span>
              </div>
              <div className="muted small" style={{ overflowWrap: "anywhere" }}>
                {a.context?.description ?? PURPOSE_LABEL[a.purpose] ?? a.purpose}
                {a.error && a.status !== "captured" ? ` ・ ${a.error}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

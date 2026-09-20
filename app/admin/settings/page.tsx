import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  updateSiteSettings,
  updateListingSettings,
  updateNotifySettings,
  updateMaintenanceSettings,
} from "./actions";

const REPORT_AUTO_HIDE_OPTIONS = ["1件", "3件", "5件", "10件", "自動非表示にしない"];
const HOUR_OPTIONS = ["0:00", "6:00", "7:00", "8:00", "9:00", "10:00"];
const HOUR_END_OPTIONS = ["18:00", "20:00", "21:00", "22:00", "23:00", "24:00"];

function ToggleRow({
  name,
  defaultChecked,
  title,
  desc,
}: {
  name: string;
  defaultChecked?: boolean;
  title: string;
  desc?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, display: "block" }}>{title}</span>
        {desc && <span className="muted" style={{ fontSize: 12.5 }}>{desc}</span>}
      </span>
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        style={{ width: 18, height: 18, flexShrink: 0 }}
      />
    </label>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  const s = settings ?? ({} as Record<string, any>);
  const tab = searchParams.tab ?? "basic";

  const tabs: { key: string; label: string }[] = [
    { key: "basic", label: "基本設定" },
    { key: "listing", label: "掲載・審査設定" },
    { key: "notify", label: "通知設定" },
    { key: "maintenance", label: "メンテナンス" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>サイト設定</h1>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          className="card"
          style={{ width: 200, flexShrink: 0, padding: 8, display: "flex", flexDirection: "column", gap: 2 }}
        >
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/settings?tab=${t.key}`}
              className={`btn ${tab === t.key ? "primary" : ""}`}
              style={{ justifyContent: "flex-start", fontSize: 13 }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 320 }}>
          {tab === "listing" && (
            <div className="card" style={{ maxWidth: 640 }}>
              <form action={updateListingSettings}>
                <h3 style={{ marginBottom: 4 }}>店舗掲載</h3>
                <ToggleRow
                  name="listingAcceptNew"
                  defaultChecked={s.listing_accept_new ?? true}
                  title="新規掲載申込を受け付ける"
                  desc="店舗から掲載申込フォームを送信できます"
                />
                <ToggleRow
                  name="listingRequireReview"
                  defaultChecked={s.listing_require_review ?? true}
                  title="公開前の運営審査"
                  desc="新規店舗は運営の承認後に公開します"
                />
                <ToggleRow
                  name="listingInstantUpdate"
                  defaultChecked={s.listing_instant_update ?? false}
                  title="店舗による即時更新"
                  desc="承認済み店舗が基本情報を審査なしで更新できます"
                />
                <ToggleRow
                  name="listingExpiryNotify"
                  defaultChecked={s.listing_expiry_notify ?? true}
                  title="掲載期限の自動通知"
                  desc="掲載期限の14日前に店舗と運営へ通知します"
                />

                <h3 style={{ margin: "22px 0 10px" }}>通報・自動制限</h3>
                <div className="field">
                  <span className="muted">自動非表示にする通報数</span>
                  <select name="reportAutoHideCount" defaultValue={s.report_auto_hide_count ?? "3件"}>
                    {REPORT_AUTO_HIDE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 18 }}>
                  <button type="submit" className="btn primary">
                    保存する
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === "notify" && (
            <div className="card" style={{ maxWidth: 640 }}>
              <form action={updateNotifySettings}>
                <h3 style={{ marginBottom: 4 }}>運営への通知</h3>
                <div className="field">
                  <span className="muted">通知先メールアドレス</span>
                  <input
                    type="email"
                    name="notifyEmail"
                    placeholder="例: notify@pokersummit.jp"
                    defaultValue={s.notify_email ?? ""}
                  />
                </div>
                <ToggleRow
                  name="notifyNewListing"
                  defaultChecked={s.notify_new_listing ?? true}
                  title="新規掲載申込"
                  desc="店舗から掲載申込が届いた時に通知します"
                />
                <ToggleRow
                  name="notifyNewReport"
                  defaultChecked={s.notify_new_report ?? true}
                  title="新規通報"
                  desc="店舗・求人・掲示板への通報を受信した時に通知します"
                />
                <ToggleRow
                  name="notifyInquiry"
                  defaultChecked={s.notify_inquiry ?? true}
                  title="お問い合わせ"
                  desc="会員・店舗からお問い合わせが届いた時に通知します"
                />
                <ToggleRow
                  name="notifyBannerAnomaly"
                  defaultChecked={s.notify_banner_anomaly ?? true}
                  title="バナー計測異常"
                  desc="表示・クリック数に大きな変動があった時に通知します"
                />

                <h3 style={{ margin: "22px 0 4px" }}>店舗・会員への自動通知</h3>
                <ToggleRow
                  name="autoNotifyListingResult"
                  defaultChecked={s.auto_notify_listing_result ?? true}
                  title="掲載申込の審査結果"
                  desc="承認または却下を申込店舗へ送信します"
                />
                <ToggleRow
                  name="autoNotifyImportant"
                  defaultChecked={s.auto_notify_important ?? true}
                  title="重要なお知らせ"
                  desc="運営が重要指定したお知らせをメールでも送信します"
                />

                <h3 style={{ margin: "22px 0 10px" }}>配信時間</h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="field" style={{ flex: 1, minWidth: 140 }}>
                    <span className="muted">通常通知の送信開始</span>
                    <select name="notifyStartHour" defaultValue={s.notify_start_hour ?? "9:00"}>
                      {HOUR_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 140 }}>
                    <span className="muted">通常通知の送信終了</span>
                    <select name="notifyEndHour" defaultValue={s.notify_end_hour ?? "22:00"}>
                      {HOUR_END_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  ※セキュリティ関連の重要通知は時間帯に関係なく即時送信されます。実際のメール送信は今後の対応予定で、現時点では設定の保存のみ行われます。
                </p>

                <div style={{ marginTop: 18 }}>
                  <button type="submit" className="btn primary">
                    保存する
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === "maintenance" && (
            <>
              <div className="card" style={{ maxWidth: 640, marginBottom: 20, borderColor: "var(--critical)" }}>
                <form action={updateMaintenanceSettings}>
                  <h3 style={{ marginBottom: 4 }}>メンテナンスモード</h3>
                  <label
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      background: "rgba(230, 80, 80, 0.08)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      marginBottom: 14,
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, display: "block" }}>
                        公開サイトをメンテナンス表示にする
                      </span>
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        一般ユーザーの閲覧を停止します。
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      name="maintenanceMode"
                      value="1"
                      defaultChecked={s.maintenance_mode ?? false}
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <div className="field" style={{ flex: 1, minWidth: 180 }}>
                      <span className="muted">開始予定</span>
                      <input
                        type="datetime-local"
                        name="maintenanceStart"
                        defaultValue={s.maintenance_start ? String(s.maintenance_start).slice(0, 16) : ""}
                      />
                    </div>
                    <div className="field" style={{ flex: 1, minWidth: 180 }}>
                      <span className="muted">終了予定</span>
                      <input
                        type="datetime-local"
                        name="maintenanceEnd"
                        defaultValue={s.maintenance_end ? String(s.maintenance_end).slice(0, 16) : ""}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <span className="muted">表示メッセージ</span>
                    <textarea
                      name="maintenanceMessage"
                      rows={3}
                      defaultValue={
                        s.maintenance_message ??
                        "ただいまシステムメンテナンスを実施しています。終了までしばらくお待ちください。"
                      }
                    />
                  </div>
                  <div className="field">
                    <span className="muted">閲覧を許可するIPアドレス</span>
                    <input
                      type="text"
                      name="maintenanceAllowedIps"
                      placeholder="例: 203.0.113.10（複数の場合はカンマ区切り）"
                      defaultValue={s.maintenance_allowed_ips ?? ""}
                    />
                  </div>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    ※開始・終了予定と許可IPアドレスは参考表示用の項目です。実際の公開/非公開は上のチェックボックスの状態のみで切り替わります。
                  </p>
                  <div style={{ marginTop: 14 }}>
                    <button type="submit" className="btn primary">
                      保存する
                    </button>
                  </div>
                </form>
              </div>

              <div className="card" style={{ maxWidth: 640 }}>
                <h3 style={{ marginBottom: 10 }}>データ保守</h3>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 700, display: "block" }}>データ整合性チェック</span>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      店舗・会員データの関連に問題がないか確認します
                    </span>
                  </span>
                  <Link href="/admin/system" className="btn" style={{ fontSize: 12.5 }}>
                    システム管理へ
                  </Link>
                </div>
              </div>
            </>
          )}

          {tab === "basic" && (
            <div className="card" style={{ maxWidth: 640 }}>
              <form action={updateSiteSettings}>
                <div className="field">
                  <span className="muted">サイト名 *</span>
                  <input
                    type="text"
                    name="siteName"
                    required
                    defaultValue={s.site_name ?? "Poker Summit"}
                  />
                </div>
                <div className="field">
                  <span className="muted">サポート用メールアドレス</span>
                  <input type="email" name="contactEmail" defaultValue={s.contact_email ?? ""} />
                </div>
                <div className="field">
                  <span className="muted">お知らせバナー文言（ポータル上部に表示・空欄で非表示）</span>
                  <textarea name="announcement" rows={3} defaultValue={s.announcement ?? ""} />
                </div>
                <button type="submit" className="btn primary">
                  保存する
                </button>
              </form>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
                禁止ワードの管理は「
                <Link href="/admin/ng-words">NGワード</Link>
                」ページから行えます。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

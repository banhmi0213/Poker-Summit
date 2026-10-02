"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

export type StoreTabKey = "menu" | "events" | "coupons" | "notices" | "jobs";

const TAB_META: { key: StoreTabKey; icon: string; label: string }[] = [
  { key: "menu", icon: "🍴", label: "料金・メニュー" },
  { key: "events", icon: "📅", label: "イベント" },
  { key: "coupons", icon: "🎫", label: "クーポン" },
  { key: "notices", icon: "📰", label: "お知らせ" },
  { key: "jobs", icon: "💼", label: "求人" },
];

export type CouponPreview = { id: string; title: string; description: string | null; validUntil: string | null };
export type NoticePreview = { id: string; title: string; body: string | null; createdAtLabel: string };
export type JobPreview = { id: string; title: string; salary: string | null };
export type CalendarCell = { day: number; hasEvent: boolean; isToday: boolean } | null;

// 店舗詳細ページのタブ切り替え＋右カラム(サイドバー)。2026/10、TOPから店舗詳細
// に入ったときのデザイン刷新で追加。「まだ動かんでいい、とりあえず中身デザ
// インする」との指示のとおり、ここでは見た目とタブ切り替え(クリックで表示
// を出し分けるだけのクライアント側の話で、サーバー側のデータ取得・承認フロー
// などは何も変えていない)だけを実装している。各タブの中身は page.tsx 側で
// サーバーコンポーネントとして描画したものをReactNodeとしてそのまま受け取り
// (お気に入り登録・クーポン利用などの既存のサーバーアクションはそのまま
// 動く)、ここではdisplay切り替えで出し分けるだけ。サイドバーのプレビュー
// (クーポン・お知らせ・求人)はリンクを組み立てるだけの単純な表示なので、
// 必要なデータだけ受け取ってこのクライアントコンポーネント側で組み立てる。
export function StoreTabs({
  tabs,
  couponsCount,
  couponPreview,
  noticesCount,
  noticePreview,
  jobsCount,
  jobPreview,
  calendar,
}: {
  tabs: Record<StoreTabKey, { count: number; content: ReactNode }>;
  couponsCount: number;
  couponPreview: CouponPreview | null;
  noticesCount: number;
  noticePreview: NoticePreview | null;
  jobsCount: number;
  jobPreview: JobPreview | null;
  calendar: { label: string; weeks: CalendarCell[][] };
}) {
  const [active, setActive] = useState<StoreTabKey>("menu");

  return (
    <div className="store-tabs-wrap">
      <div className="store-tabs">
        {TAB_META.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`store-tab${active === t.key ? " active" : ""}`}
            onClick={() => setActive(t.key)}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="store-detail-grid">
        <div className="store-detail-main">
          {TAB_META.map((t) => (
            <div key={t.key} style={{ display: active === t.key ? "block" : "none" }}>
              {tabs[t.key].content}
            </div>
          ))}
        </div>

        <div className="store-detail-side">
          <div className="sidebar-card">
            <div className="sidebar-card-head">
              <h3>🎫 クーポン ({couponsCount})</h3>
              <button type="button" className="see-all" onClick={() => setActive("coupons")}>
                すべて見る ›
              </button>
            </div>
            {couponPreview ? (
              <div className="coupon-preview-card">
                <div className="coupon-preview-icon">🎟️</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{couponPreview.title}</div>
                {couponPreview.description && (
                  <p className="muted small" style={{ marginBottom: 8 }}>
                    {couponPreview.description}
                  </p>
                )}
                {couponPreview.validUntil && (
                  <p className="muted small" style={{ marginBottom: 10 }}>
                    有効期限：{couponPreview.validUntil}
                  </p>
                )}
                <Link href={`/coupons/${couponPreview.id}`} className="btn primary" style={{ width: "100%", justifyContent: "center" }}>
                  クーポンを見る
                </Link>
              </div>
            ) : (
              <p className="muted small">現在利用可能なクーポンはありません。</p>
            )}
          </div>

          <div className="sidebar-card">
            <div className="sidebar-card-head">
              <h3>📰 お知らせ ({noticesCount})</h3>
              <button type="button" className="see-all" onClick={() => setActive("notices")}>
                すべて見る ›
              </button>
            </div>
            {noticePreview ? (
              <button type="button" className="sidebar-list-item" onClick={() => setActive("notices")}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{noticePreview.title}</div>
                {noticePreview.body && (
                  <p className="muted small" style={{ marginBottom: 4 }}>
                    {noticePreview.body}
                  </p>
                )}
                <p className="muted small">{noticePreview.createdAtLabel}</p>
              </button>
            ) : (
              <p className="muted small">現在お知らせはありません。</p>
            )}
          </div>

          <div className="sidebar-card">
            <div className="sidebar-card-head">
              <h3>🗓️ 月間スケジュール</h3>
            </div>
            <p className="muted small" style={{ marginBottom: 8 }}>{calendar.label}</p>
            <div className="mini-calendar">
              {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                <div key={d} className="mini-calendar-head">
                  {d}
                </div>
              ))}
              {calendar.weeks.flat().map((cell, i) => (
                <div
                  key={i}
                  className={`mini-calendar-day${cell?.isToday ? " today" : ""}${cell?.hasEvent ? " has-event" : ""}`}
                >
                  {cell ? cell.day : ""}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              style={{ width: "100%", justifyContent: "center", marginTop: 10, fontSize: 12.5 }}
              onClick={() => setActive("events")}
            >
              📅 スケジュールを拡大
            </button>
          </div>

          <div className="sidebar-card">
            <div className="sidebar-card-head">
              <h3>💼 求人情報 ({jobsCount})</h3>
              <button type="button" className="see-all" onClick={() => setActive("jobs")}>
                すべて見る ›
              </button>
            </div>
            {jobPreview ? (
              <button type="button" className="sidebar-list-item" onClick={() => setActive("jobs")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{jobPreview.title}</div>
                    {jobPreview.salary && <p className="muted small">{jobPreview.salary}</p>}
                  </div>
                  <span aria-hidden="true">›</span>
                </div>
              </button>
            ) : (
              <p className="muted small">現在募集中の求人はありません。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

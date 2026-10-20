"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_ATTENTION_ITEMS, CountBadge, useAttentionCounts } from "@/app/attention-counts";

const ADMIN_LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/analytics", label: "アクセス統計" },
  { href: "/admin/stores", label: "店舗管理" },
  { href: "/admin/stores/import", label: "店舗取込(Google)" },
  { href: "/admin/stores/google-match", label: "Googleマップ照合" },
  { href: "/admin/contracts", label: "契約店舗" },
  { href: "/admin/contracts/plans", label: "プラン・アドオン管理" },
  { href: "/admin/billing", label: "入金管理" },
  { href: "/admin/addon-orders", label: "アドオン注文" },
  { href: "/admin/stores/bulk-email", label: "お知らせ配信" },
  { href: "/admin/message-log", label: "送信履歴" },
  { href: "/admin/listing-applications", label: "掲載申込" },
  { href: "/admin/jobs", label: "求人管理" },
  { href: "/admin/events", label: "イベント管理" },
  { href: "/admin/poker-rings", label: "リングゲーム卓設定" },
  { href: "/admin/poker-tournaments", label: "オンライン大会設定" },
  { href: "/admin/coupons", label: "クーポン管理" },
  { href: "/admin/board", label: "掲示板管理" },
  { href: "/admin/blog", label: "BLOG管理" },
  { href: "/admin/major-tournaments", label: "国内外大型大会" },
  { href: "/admin/reports", label: "通報管理" },
  { href: "/admin/dealer-chat-reports", label: "マッチング通報" },
  { href: "/admin/banners", label: "バナー管理" },
  { href: "/admin/members", label: "会員管理" },
  { href: "/admin/inquiries", label: "お問い合わせ" },
  { href: "/admin/admins", label: "運営ユーザー" },
  { href: "/admin/audit-log", label: "操作ログ" },
  { href: "/admin/ng-words", label: "NGワード" },
  { href: "/admin/settings", label: "サイト設定" },
  { href: "/admin/system", label: "システム" },
];

// メニュー横の赤い件数の印(要対応・未確認)。admin_attention_counts() のキーと対応(2026/10)
const BADGE_KEYS: Record<string, string> = {
  "/admin/stores": "stores_pending",
  "/admin/contracts": "contracts",
  "/admin/billing": "billing",
  "/admin/addon-orders": "addon_orders",
  "/admin/listing-applications": "listing_applications",
  "/admin/reports": "reports",
  "/admin/dealer-chat-reports": "dealer_chat_reports",
  "/admin/inquiries": "inquiries",
};

// /admin/stores と /admin/stores/import のように一方が他方のURLの接頭辞に
// なっているリンクが複数あるため、単純な startsWith だけで判定すると
// 例えば /admin/stores/import を開いた時に「店舗管理」「店舗取込(Google)」
// の両方が同時に点灯してしまう(2026/10、「選んでる欄だけ色つくように」
// との指摘で発覚)。ここでは現在地にマッチする候補の中から最もhrefが長い
// (＝最も具体的な)ものだけを選び、1つだけactiveにする。
function matchesPath(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  // スマホでは「メニュー」ボタンで一覧を開く(横スクロールだと他の項目に気づけないため、2026/10)
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  const counts = useAttentionCounts("admin");
  const total = Object.values(BADGE_KEYS).reduce((n, k) => n + (counts[k] ?? 0), 0);

  const activeHref = ADMIN_LINKS.filter((l) => matchesPath(l.href, pathname)).sort(
    (a, b) => b.href.length - a.href.length
  )[0]?.href;

  return (
    <nav className="app-sidebar">
      <div className="brand wordmark">
        <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
        <small>総合管理画面{total > 0 && <CountBadge count={total} label="要対応の合計" />}</small>
      </div>
      <button type="button" className="app-menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
        <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span> メニュー{!menuOpen && (ADMIN_LINKS.find((l) => l.href === activeHref)?.label) ? <span className="app-menu-current">（{(ADMIN_LINKS.find((l) => l.href === activeHref)?.label)}）</span> : null}
        {!menuOpen && total > 0 && <CountBadge count={total} label="未対応の合計" />}
      </button>
      <div className={`app-menu-links${menuOpen ? " open" : ""}`}>
      {ADMIN_LINKS.map((l) => {
        const active = l.href === activeHref;
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            className={`side-link${active ? " active" : ""}`}
          >
            {l.label}
            {BADGE_KEYS[l.href] && <CountBadge count={counts[BADGE_KEYS[l.href]]} label={ADMIN_ATTENTION_ITEMS.find((i) => i.key === BADGE_KEYS[l.href])?.label} />}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}

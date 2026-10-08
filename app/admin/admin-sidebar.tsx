"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/analytics", label: "アクセス統計" },
  { href: "/admin/stores", label: "店舗管理" },
  { href: "/admin/stores/import", label: "店舗取込(Google)" },
  { href: "/admin/contracts", label: "契約店舗" },
  { href: "/admin/stores/bulk-email", label: "一斉メール" },
  { href: "/admin/listing-applications", label: "掲載申込" },
  { href: "/admin/jobs", label: "求人管理" },
  { href: "/admin/events", label: "イベント管理" },
  { href: "/admin/coupons", label: "クーポン管理" },
  { href: "/admin/board", label: "掲示板管理" },
  { href: "/admin/blog", label: "BLOG管理" },
  { href: "/admin/major-tournaments", label: "国内外大型大会" },
  { href: "/admin/reports", label: "通報管理" },
  { href: "/admin/banners", label: "バナー管理" },
  { href: "/admin/members", label: "会員管理" },
  { href: "/admin/inquiries", label: "お問い合わせ" },
  { href: "/admin/admins", label: "運営ユーザー" },
  { href: "/admin/audit-log", label: "操作ログ" },
  { href: "/admin/ng-words", label: "NGワード" },
  { href: "/admin/settings", label: "サイト設定" },
  { href: "/admin/system", label: "システム" },
];

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

  const activeHref = ADMIN_LINKS.filter((l) => matchesPath(l.href, pathname)).sort(
    (a, b) => b.href.length - a.href.length
  )[0]?.href;

  return (
    <nav className="app-sidebar">
      <div className="brand wordmark">
        <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
        <small>総合管理画面</small>
      </div>
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
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/analytics", label: "アクセス分析" },
  { href: "/admin/stores", label: "店舗管理" },
  { href: "/admin/listing-applications", label: "掲載申込" },
  { href: "/admin/jobs", label: "求人管理" },
  { href: "/admin/events", label: "イベント管理" },
  { href: "/admin/coupons", label: "クーポン管理" },
  { href: "/admin/board", label: "掲示板管理" },
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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar">
      <div className="brand">
        Poker Summit
        <small>管理画面</small>
      </div>
      {ADMIN_LINKS.map((l) => {
        const active =
          l.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`side-link${active ? " active" : ""}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

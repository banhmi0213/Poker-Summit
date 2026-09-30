"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 「店舗管理」ページは求人・クーポン・イベント・お知らせ・写真の管理を
// すべて1ページの中のセクションとしてまとめて持っているため、以前はサイド
// メニューが「店舗管理」「アクセス分析」の2項目だけだった。1ページに全部
// 詰まっていて目的のセクションまで毎回スクロールが必要で分かりにくい、
// という指摘を受け、それぞれのセクションへ直接ジャンプできるアンカー
// リンクをサイドメニューにも並べる形に変更(2026/09/30)。実体は別ページ
// ではなく同じ/store/profile内の#id自己文アンカーなので、リンク先を
// 増やしても管理対象のページ数が増えるわけではない。
const STORE_LINKS: { href: string; label: string }[] = [
  { href: "/store/profile", label: "店舗管理" },
  { href: "/store/profile#jobs", label: "求人管理" },
  { href: "/store/profile#coupons", label: "クーポン管理" },
  { href: "/store/profile#events", label: "イベント管理" },
  { href: "/store/profile#notices", label: "お知らせ管理" },
  { href: "/store/profile#photos", label: "店舗写真" },
  { href: "/store/profile/analytics", label: "アクセス分析" },
];

export function StoreSidebar() {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar">
      <div className="brand wordmark">
        <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
        <small>店舗管理画面</small>
      </div>
      {STORE_LINKS.map((l) => {
        const path = l.href.split("#")[0];
        const active = path === "/store/profile" ? pathname === "/store/profile" : pathname?.startsWith(path);
        // 同一ページ内アンカー(#jobs等)は個別にactive判定できないため、
        // 「店舗管理」トップリンクだけを代表してハイライトする。
        const isAnchor = l.href.includes("#");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`side-link${active && !isAnchor ? " active" : ""}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

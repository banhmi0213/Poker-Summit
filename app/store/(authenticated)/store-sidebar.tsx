"use client";
import {NotificationBadge} from "@/app/matching/chat/notification-badge";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 以前は求人・クーポン・イベント・お知らせ・写真・プランを/store/profile
// 1ページ内のアンカーリンク(#jobs等)としてまとめていたが、「求人を押した
// のにクーポンまで一緒に出てくる」という指摘を受け、各セクションを完全に
// 別ページへ分離した(2026/09/30)。管理画面(/admin)側と同じ、1メニュー
// 1ページの構成に揃えている。
// ただし店舗写真だけは「店舗写真を消して店舗管理に画像を入れれるように
// して」との指示により独立ページにせず、店舗管理(店舗情報)ページの中に
// 残しているため、ここには項目を作らない(2026/09/30)。
const STORE_LINKS: { href: string; label: string }[] = [
  { href: "/store/profile", label: "店舗情報" },
  { href: "/store/profile/analytics", label: "アクセス統計" },
  { href: "/store/profile/menu", label: "料金・メニュー" },
  { href: "/store/profile/events", label: "トーナメント・イベント" },
  { href: "/store/profile/coupons", label: "クーポン" },
  { href: "/store/profile/jobs", label: "求人" },
  { href: "/store/profile/spot-jobs", label: "スポット求人" },
  { href: "/store/profile/notices", label: "お知らせ" },
  { href: "/store/profile/plan", label: "プラン・お支払い" },
];

export function StoreSidebar() {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar">
      <div className="brand wordmark">
        <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
        <small>店舗管理画面</small>
      </div>
      {STORE_LINKS.map((l) => {
        const active = l.href === "/store/profile" ? pathname === "/store/profile" : pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            className={`side-link${active ? " active" : ""}`}
          >
            {l.label}{l.href==="/store/profile/spot-jobs"&&<NotificationBadge actor="store"/>}
          </Link>
        );
      })}
    </nav>
  );
}

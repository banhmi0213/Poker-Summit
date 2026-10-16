"use client";
import {NotificationBadge} from "@/app/matching/chat/notification-badge";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountBadge, useAttentionCounts } from "@/app/attention-counts";

// 以前は求人・クーポン・イベント・お知らせ・写真・プランを/store/profile
// 1ページ内のアンカーリンク(#jobs等)としてまとめていたが、「求人を押した
// のにクーポンまで一緒に出てくる」という指摘を受け、各セクションを完全に
// 別ページへ分離した(2026/09/30)。管理画面(/admin)側と同じ、1メニュー
// 1ページの構成に揃えている。
// ただし店舗写真だけは「店舗写真を消して店舗管理に画像を入れれるように
// して」との指示により独立ページにせず、店舗管理(店舗情報)ページの中に
// 残しているため、ここには項目を作らない(2026/09/30)。
const STORE_LINKS: { href: string; label: string }[] = [
  { href: "/store/profile/messages", label: "運営からのお知らせ" },
  { href: "/store/profile", label: "店舗情報" },
  { href: "/store/profile/analytics", label: "アクセス統計" },
  { href: "/store/profile/menu", label: "料金・メニュー" },
  { href: "/store/profile/events", label: "トーナメント・イベント" },
  { href: "/store/profile/poker-tournaments", label: "オンライン大会設定" },
  { href: "/store/profile/coupons", label: "クーポン" },
  { href: "/store/profile/jobs", label: "求人" },
  { href: "/store/profile/spot-jobs", label: "スポット求人" },
  { href: "/store/profile/notices", label: "店舗のお知らせ" },
  { href: "/store/profile/plan", label: "プラン・お支払い" },
];

export function StoreSidebar({ tournamentEnabled = false }: { tournamentEnabled?: boolean }) {
  const pathname = usePathname();
  const counts = useAttentionCounts("store");
  const total = (counts.job_applications ?? 0) + (counts.messages ?? 0);

  return (
    <nav className="app-sidebar">
      <div className="brand wordmark">
        <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
        <small>店舗管理画面{total > 0 && <CountBadge count={total} label="未確認の合計" />}</small>
      </div>
      {STORE_LINKS.map((l) => {
        const active = l.href === "/store/profile" ? pathname === "/store/profile" : pathname?.startsWith(l.href);
        if (l.href === "/store/profile/poker-tournaments" && !tournamentEnabled) return <span key={l.href} className="side-link" aria-disabled="true" title="運営から利用を許可された店舗のみ使用できます" style={{ color: "#777", background: "#eee", opacity: .65, cursor: "not-allowed" }}>{l.label}<small style={{ display: "block", fontSize: 11 }}>運営の利用許可が必要です</small></span>;
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            className={`side-link${active ? " active" : ""}`}
          >
            {l.label}{l.href==="/store/profile/spot-jobs"&&<NotificationBadge actor="store"/>}
            {l.href === "/store/profile/jobs" && <CountBadge count={counts.job_applications} label="新着応募" />}
            {l.href === "/store/profile/messages" && <CountBadge count={counts.messages} label="未読のお知らせ" />}
          </Link>
        );
      })}
    </nav>
  );
}

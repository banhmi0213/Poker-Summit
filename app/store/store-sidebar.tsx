"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STORE_LINKS: { href: string; label: string }[] = [
  { href: "/store/profile", label: "店舗管理" },
  { href: "/store/profile/analytics", label: "アクセス分析" },
];

export function StoreSidebar() {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar">
      <div className="brand">
        Poker Summit
        <small>店舗管理画面</small>
      </div>
      {STORE_LINKS.map((l) => {
        const active =
          l.href === "/store/profile" ? pathname === "/store/profile" : pathname?.startsWith(l.href);
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

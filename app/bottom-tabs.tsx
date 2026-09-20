import Link from "next/link";

const ITEMS: { key: string; href: string; icon: string; label: string }[] = [
  { key: "home", href: "/", icon: "🏠", label: "ホーム" },
  { key: "stores", href: "/#store-list", icon: "🏪", label: "店舗" },
  { key: "jobs", href: "/jobs", icon: "💼", label: "求人" },
  { key: "board", href: "/board", icon: "💬", label: "サミット" },
  { key: "mypage", href: "/mypage", icon: "👤", label: "マイページ" },
];

export function BottomTabs({ active }: { active?: string }) {
  return (
    <div className="bottom-tabs">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`bt-item ${active === item.key ? "active" : ""}`}
        >
          <span className="ic">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

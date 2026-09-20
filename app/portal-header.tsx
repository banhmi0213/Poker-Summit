import Link from "next/link";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/#store-list", label: "店舗を探す" },
  { href: "/jobs", label: "求人を探す" },
  { href: "/coupons", label: "クーポン" },
  { href: "/events", label: "トーナメント・イベント" },
  { href: "/board", label: "サミット" },
];

export function PortalHeader({ userEmail }: { userEmail?: string | null }) {
  return (
    <header className="header" style={{ flexWrap: "wrap", gap: 10, rowGap: 8 }}>
      <Link href="/" className="brand">
        Poker Summit
      </Link>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="btn">
            {l.label}
          </Link>
        ))}
        <Link href="/contact" className="btn">
          お問い合わせ
        </Link>
        {userEmail ? (
          <Link href="/mypage" className="btn">
            マイページ
          </Link>
        ) : (
          <Link href="/signup" className="btn">
            会員登録/ログイン
          </Link>
        )}
        <Link href="/login" className="btn">
          店舗・運営ログイン
        </Link>
      </div>
    </header>
  );
}

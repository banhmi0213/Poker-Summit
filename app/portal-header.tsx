import Link from "next/link";

const NAV_LINKS: { href: string; label: string; sub?: string }[] = [
  { href: "/#store-list", label: "店舗を探す" },
  { href: "/jobs", label: "求人を探す" },
  { href: "/coupons", label: "クーポン" },
  { href: "/events", label: "トーナメント・イベント" },
  { href: "/board", label: "サミット", sub: "(情報交換)" },
];

export function PortalHeader({ userEmail }: { userEmail?: string | null }) {
  const memberBtn = userEmail ? (
    <Link href="/mypage" className="btn primary">
      マイページ
    </Link>
  ) : (
    <Link href="/signup" className="btn primary">
      会員登録/ログイン
    </Link>
  );

  return (
    <header className="header" style={{ flexWrap: "wrap", gap: 10, rowGap: 8 }}>
      <input type="checkbox" id="mobile-nav-toggle" className="nav-toggle" />
      <Link href="/" className="brand">
        Poker Summit
      </Link>
      <div className="portal-links" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="btn">
            {l.label}
          </Link>
        ))}
        <Link href="/contact" className="btn">
          お問い合わせ
        </Link>
        {memberBtn}
        <Link href="/login" className="btn">
          店舗・運営ログイン
        </Link>
      </div>
      <label htmlFor="mobile-nav-toggle" className="nav-hamburger" aria-label="メニュー">
        ☰
      </label>
      <div className="mobile-nav-drawer">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="btn">
            {l.label}
            {l.sub ? <span className="muted" style={{ marginLeft: 4 }}>{l.sub}</span> : null}
          </Link>
        ))}
        <Link href="/contact" className="btn">
          お問い合わせ
        </Link>
        {memberBtn}
        <Link href="/login" className="btn">
          店舗・運営ログイン
        </Link>
      </div>
    </header>
  );
}

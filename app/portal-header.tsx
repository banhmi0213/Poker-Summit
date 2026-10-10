import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./header-region.module.css";

const NAV_LINKS: { href: string; label: string; sub?: string }[] = [
  { href: "/stores", label: "店舗を探す" },
  { href: "/events", label: "トーナメント・イベント" },
  { href: "/coupons", label: "クーポン" },
  { href: "/board", label: "サミット", sub: "(情報交換)" },
  { href: "/jobs", label: "求人を探す" },
];

export function PortalHeader({ userEmail, regionSelector }: { userEmail?: string | null; regionSelector?: ReactNode }) {
  const memberLinks = userEmail ? (
    <Link href="/mypage" className="portal-cta">
      マイページ
    </Link>
  ) : (
    <>
      <Link href="/signup" className="portal-cta">
        会員登録
      </Link>
      <Link href="/login" className="portal-cta">
        ログイン
      </Link>
    </>
  );

  return (
    <nav className={`portal-nav ${styles.header}`}>
      <input type="checkbox" id="mobile-nav-toggle" className="nav-toggle" />
      <div className="portal-nav-inner">
        <Link href="/" className="portal-logo">
          <img className="logo-img" src="/images/logo.webp" alt="Poker Summit" />
        </Link>
        <div className="portal-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="plink">
              {l.label}
              {l.sub ? (
                <span className="muted" style={{ marginLeft: 4, fontSize: 12 }}>
                  {l.sub}
                </span>
              ) : null}
            </Link>
          ))}
          <Link href="/news" className="plink">
            お知らせ
          </Link>
          <Link href="/blog" className="plink">BLOG</Link>
          <Link href="/major-tournaments" className="plink">国内外大型大会</Link>
        </div>
        <div className="portal-auth-actions">
          {regionSelector && <div className={styles.desktop}>{regionSelector}</div>}
          {memberLinks}
        </div>
        {regionSelector && <div className={styles.mobile}>{regionSelector}</div>}
        <label htmlFor="mobile-nav-toggle" className="nav-hamburger" aria-label="メニュー">
          ☰
        </label>
      </div>
      <div className="mobile-nav-drawer">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="plink">
            {l.label}
            {l.sub ? <span className="muted" style={{ marginLeft: 4 }}>{l.sub}</span> : null}
          </Link>
        ))}
        <Link href="/news" className="plink">
          お知らせ
        </Link>
          <Link href="/blog" className="plink">BLOG</Link>
          <Link href="/major-tournaments" className="plink">国内外大型大会</Link>
        {memberLinks}
      </div>
    </nav>
  );
}

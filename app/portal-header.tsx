import Link from "next/link";

const NAV_LINKS: { href: string; label: string; sub?: string }[] = [
  { href: "/stores", label: "店舗を探す" },
  { href: "/jobs", label: "求人を探す" },
  { href: "/coupons", label: "クーポン" },
  { href: "/events", label: "トーナメント・イベント" },
  { href: "/board", label: "サミット", sub: "(情報交換)" },
];

export function PortalHeader({ userEmail }: { userEmail?: string | null }) {
  // 会員登録・会員ログインは別々の窓(ボタン)に分ける。店舗ログインは会員と
  // 別のアカウント体系(ログインID/パスワード)なので、常に別リンクとして
  // /store/loginへ飛ばす(以前は/loginへの誤リンクになっており、店舗ログイン
  // ボタンから会員ログイン画面に飛んでしまっていた不具合を修正 2026/09/30)。
  const memberLinks = userEmail ? (
    <Link href="/mypage" className="portal-cta">
      マイページ
    </Link>
  ) : (
    <div className="portal-auth-group">
      <Link href="/signup" className="plink">
        会員登録
      </Link>
      <span className="portal-auth-sep" aria-hidden="true" />
      <Link href="/login" className="plink">
        ログイン
      </Link>
    </div>
  );

  const storeLoginLink = (
    <Link href="/store/login" className="btn portal-store-btn">
      店舗ログイン
    </Link>
  );

  return (
    <nav className="portal-nav">
      <input type="checkbox" id="mobile-nav-toggle" className="nav-toggle" />
      <div className="portal-nav-inner">
        <Link href="/" className="portal-logo">
          <img className="logo-img" src="/images/logo.png" alt="Poker Summit" />
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
          <Link href="/contact" className="plink">
            お問い合わせ
          </Link>
        </div>
        <div className="portal-auth-actions">
          {memberLinks}
          {storeLoginLink}
        </div>
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
        <Link href="/contact" className="plink">
          お問い合わせ
        </Link>
        {memberLinks}
        {storeLoginLink}
      </div>
    </nav>
  );
}

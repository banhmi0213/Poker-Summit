"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import styles from "./header-region.module.css";
import { NewsDot } from "./news-dot";
import { JOB_ENTRANCES, jobEntranceHref } from "@/lib/job-categories";

type MenuLink = { label: string; href: string | null; image?: string; description?: string };
type MenuGroup = { label: string; href?: string; links: MenuLink[] };
const GROUPS: MenuGroup[] = [
  { label: "店舗情報", links: [
    { label: "店舗検索", href: "/stores", image: "/images/navigation/stores-v1.webp", description: "地域や店舗タイプから、お店を探す" },
    { label: "クーポン", href: "/coupons", image: "/images/navigation/coupons-v1.webp", description: "ポーカー店舗のお得な特典をチェック" },
    { label: "トーナメント・イベント", href: "/events", image: "/images/navigation/events-v1.webp", description: "開催中・開催予定の情報をチェック" },
  ] },
  { label: "Summit Poker", links: [
    { label: "ポーカーロビー", href: "/poker-lobby", image: "/images/navigation/poker-lobby-v1.webp", description: "オンライン対戦・卓への参加" },
    { label: "プレイヤーページ／GTO", href: "/mypage/poker", image: "/images/navigation/player-gto-v1.webp", description: "成績の確認・GTO表・GTOと対戦" },
  ] },
  { label: "求人", links: JOB_ENTRANCES.map(entry => ({ label: entry.label, href: jobEntranceHref(entry), image: "/images/job-categories-photo-v1.webp", description: entry.label + "の募集を見る" })) },
  { label: "国内外大型大会", links: [
    { label: "国内", href: "/major-tournaments?scope=" + encodeURIComponent("国内"), image: "/images/navigation/domestic-v1.webp", description: "日本で開催される大型大会を探す" },
    { label: "海外", href: "/major-tournaments?scope=" + encodeURIComponent("海外"), image: "/images/navigation/overseas-v1.webp", description: "世界の大型大会・スケジュールを探す" },
  ] },
  { label: "オリジナルコンテンツ", links: [
    { label: "サミット", href: "/board", image: "/images/navigation/community-v1.webp", description: "ポーカー仲間との交流・質問・情報交換" },
    { label: "BLOG", href: "/blog", image: "/images/navigation/blog-v1.webp", description: "ポーカーの楽しみ方がもっと広がる" },
    { label: "GTO・学習", href: "/learn", image: "/images/navigation/learn-v1.webp", description: "登録なしで使える無料のGTO表・計算機・レッスン" },
    { label: "お知らせ", href: "/news", image: "/images/navigation/notice-v1.webp", description: "Poker Summitからの最新情報" },
  ] },
];

export function PortalHeader({ userEmail, regionSelector }: { userEmail?: string | null; regionSelector?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const closeMobile = () => {
    const toggle = document.getElementById("mobile-nav-toggle") as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
    setOpen(null);
  };
  const memberLinks = userEmail ? <Link href="/mypage" className="portal-cta">マイページ</Link> : <>
    <Link href="/signup" className="portal-cta">会員登録</Link>
    <Link href="/login" className="portal-cta">ログイン</Link>
  </>;
  const renderLinks = (index: number, mobile = false) => GROUPS[index].links.map(link =>
    link.href
      ? <Link key={link.label} href={link.href} onClick={mobile ? closeMobile : () => setOpen(null)} className={styles.menuLink}>
          {!mobile && <span className={`${styles.menuArtwork} ${index === 2 ? "" : styles.fittedArtwork}`}>
            {index === 2 ? <span className={styles.jobArtwork}><img src="/images/job-categories-photo-v1.webp" alt="" style={{ left: `${-(JOB_ENTRANCES.find(entry => entry.label === link.label)?.x ?? 0) / 742 * 100}%`, top: `${-(JOB_ENTRANCES.find(entry => entry.label === link.label)?.y ?? 0) / 284 * 100}%` }} /></span>
              : link.image ? <img src={link.image} alt="" loading="lazy" decoding="async" width={1440} height={810} />
              : <span className={styles.learningArtwork}><span>POKER SUMMIT ACADEMY</span><strong>遊びながら、<br />ポーカーを学ぼう。</strong></span>}
          </span>}
          <span className={styles.menuCopy}><strong>{link.label}{link.href === "/news" && <NewsDot />}</strong>{!mobile && <small>{link.description}</small>}</span>
        </Link>
      : <span key={link.label} className={`${styles.disabled} ${!mobile && link.image ? styles.disabledCard : ""}`} aria-disabled="true">{!mobile && link.image ? <><span className={`${styles.menuArtwork} ${styles.fittedArtwork} ${index === 1 ? styles.pokerArtwork : ""}`}><img src={link.image} alt="" loading="lazy" decoding="async" width={1440} height={810}/></span><span className={styles.menuCopy}><strong>{link.label}</strong><small>{link.description}</small></span></> : <strong>{link.label}</strong>}</span>
  );

  return (
    <nav className={`portal-nav ${styles.header}`} aria-label="メインナビゲーション">
      <input type="checkbox" id="mobile-nav-toggle" className="nav-toggle" />
      <div className="portal-nav-inner">
        <Link href="/" className="portal-logo"><img className="logo-img" src="/images/logo.webp" alt="Poker Summit" /></Link>
        <p className={styles.tagline}><span className={styles.taglineCopy}>GTOで<strong>学び</strong>、オンラインで<strong>磨き</strong>、リアルで<strong>勝つ</strong></span></p>
        <div className="portal-auth-actions">
          {regionSelector && <div className={styles.desktop}>{regionSelector}</div>}
          {memberLinks}
        </div>
        {regionSelector && <div className={styles.mobile}>{regionSelector}</div>}
        <label htmlFor="mobile-nav-toggle" className="nav-hamburger" aria-label="メニュー">☰<NewsDot className="on-hamburger" /></label>
      </div>

      <div className={styles.megaNav}
        onPointerLeave={() => setOpen(null)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(null); }}
        onKeyDown={event => {
          if (event.key === "Escape" && open !== null) { const previous = open; setOpen(null); triggers.current[previous]?.focus(); }
        }}>
        <div className={styles.titles}>
          {GROUPS.map((group, index) => group.href
            ? <Link key={group.label} href={group.href} className={styles.title} onPointerEnter={() => setOpen(null)} onFocus={() => setOpen(null)}>{group.label}</Link>
            : <button key={group.label} ref={node => { triggers.current[index] = node; }} type="button"
                className={`${styles.title} ${open === index ? styles.activeTitle : ""}`}
                aria-expanded={open === index} aria-controls={`mega-panel-${index}`}
                onPointerEnter={event => { if (event.pointerType !== "touch") setOpen(index); }}
                onClick={() => setOpen(value => value === index ? null : index)}
                onKeyDown={event => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault(); setOpen(index);
                    window.setTimeout(() => { const panel = document.getElementById(`mega-panel-${index}`); if (panel?.getAttribute("aria-hidden") === "false") panel.querySelector<HTMLAnchorElement>("a")?.focus(); }, 250);
                  }
                }}>
                {group.label}<span className={styles.caret} aria-hidden="true"></span>
              </button>)}
        </div>
        {GROUPS.map((group, index) => !group.href && <div key={group.label} id={`mega-panel-${index}`}
          className={`${styles.megaPanel} ${open === index ? styles.openPanel : ""}`}
          aria-hidden={open !== index} aria-label={group.label}>
          <div className={styles.panelHeading}>{group.label}</div>
          <div className={styles.menuGrid}>{renderLinks(index)}</div>
        </div>)}
      </div>

      <div className="mobile-nav-drawer">
        {GROUPS.map((group, index) => group.href
          ? <Link key={group.label} href={group.href} className={styles.mobileDirect} onClick={closeMobile}>{group.label}</Link>
          : <details key={group.label} className={styles.mobileGroup}><summary>{group.label}<span aria-hidden="true"></span></summary><div className={styles.mobileLinks}>{renderLinks(index, true)}</div></details>)}
        {memberLinks}
      </div>
    </nav>
  );
}


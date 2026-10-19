import type * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "第1回フリーロール 大会詳細｜PokerSummit",
  description: "2026年10月25日21時開催。PokerSummit先行会員限定フリーロールの参加方法・大会概要・入賞後の賞品受け取り方法をご案内します。",
  alternates: { canonical: "/tournaments/first-freeroll" },
};
// m HOLD’EM公式サイトのアプリ導線。独自の未確認URLスキームは使用しない。
function Icon({ kind }: { kind: "gift" | "coins" | "calendar" | "phone" | "users" | "trophy" | "diamond" | "document" | "person" | "play" | "mail" }) {
  const paths: Record<string, React.ReactNode> = {
    gift: <><path d="M3 10h18v4H3zM5 14v8h14v-8M12 10v12M12 10H7a3 3 0 1 1 3-3l2 3Zm0 0h5a3 3 0 1 0-3-3l-2 3Z" /></>,
    coins: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v5c0 4 16 4 16 0V5M4 10v5c0 4 16 4 16 0v-5M4 15v4c0 4 16 4 16 0v-4" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 2v6M16 2v6M4 11h16M8 15h2M14 15h2M8 18h2" /></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 18h4" /></>,
    users: <><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0 1 12 0v3M4 10a3 3 0 0 0 0 6M20 10a3 3 0 0 1 0 6" /></>,
    trophy: <><path d="M7 3h10v7a5 5 0 0 1-10 0V3ZM7 5H3v3a5 5 0 0 0 5 5M17 5h4v3a5 5 0 0 1-5 5M12 15v6M7 22h10" /></>,
    diamond: <path d="m3 8 4-5h10l4 5-9 14L3 8Zm0 0h18M7 3l5 19L17 3" />,
    document: <><path d="M5 2h9l5 5v15H5V2ZM14 2v6h5M8 12h8M8 16h8" /></>,
    person: <><circle cx="12" cy="7" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3Z" /></>,
    play: <><circle cx="12" cy="12" r="10" /><path d="m10 7 7 5-7 5V7Z" /></>,
    mail: <><rect x="2" y="5" width="20" height="15" rx="1" /><path d="m2 5 10 8L22 5" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
const APP_URL = "https://app.adjust.com/egwr7v0";
const steps = [
  ["先行会員登録済みの会員", "先行会員登録を完了していることをご確認ください。本大会は先行会員登録済みの方が対象です。"],
  ["m HOLD’EM IDをマイページに登録", "PokerSummitのマイページで、ご自身のm HOLD’EM IDを登録してください。登録済みのIDはご自身では変更できません。"],
  ["アプリと必要なダイヤを準備", "m HOLD’EMアプリと、参加に必要なアプリ内アイテム（ダイヤ）をご準備ください。"],
  ["大会ルームに入室", "開催前にご案内するルーム情報・入室方法をご確認のうえ、指定の時間にご入室ください。"],
];
export default function FirstFreerollPage() {
  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="PokerSummit TOP"><img src="/images/logo.webp" alt="PokerSummit" /></Link><nav aria-label="大会ページメニュー"><a href="#overview">大会概要</a><a href="#how-to-join">参加方法</a><a href="#prize-claim">賞品受取</a></nav></header>
    <main className={styles.main}>
      <nav aria-label="パンくず" className={styles.breadcrumb}><Link href="/">TOP</Link><span>／</span><span>先行会員限定トーナメント</span></nav>
      <section className={styles.sampleHero} aria-labelledby="freeroll-title">
        <img src="/images/freeroll-approved-hero.png" width="950" height="386" alt="先行会員限定 PokerSummit 第1回フリーロール。その挑戦権を、つかみ取れ。2026年10月25日（日）21:00開始、m HOLD’EMアプリで開催。" fetchPriority="high" />
        <div className={styles.srOnly}><h1 id="freeroll-title">第1回フリーロール</h1><p>先行会員限定。その挑戦権を、つかみ取れ</p><time dateTime="2026-10-25T21:00:00+09:00">2026.10.25 SUN　21:00 START</time><p>m HOLD’EMアプリで開催 · 日本時間</p></div>
      </section>
      <nav className={styles.anchors} aria-label="ページ内メニュー"><a href="#overview">大会概要</a><a href="#how-to-join">参加方法</a><a href="#prize-claim">賞品受取</a></nav>
      <div className={styles.columns}>
        <section id="overview" className={styles.section}><h2><span className={styles.headingIcon} aria-hidden="true">♠</span>大会概要<small>TOURNAMENT OVERVIEW</small></h2><dl className={styles.overview}>
          <div><dt><Icon kind="calendar" />開催日時</dt><dd>2026年10月25日（日）21:00〜<small>※日本時間</small></dd></div>
          <div><dt><Icon kind="phone" />開催場所</dt><dd>m HOLD’EMアプリ</dd></div>
          <div><dt><Icon kind="users" />参加対象</dt><dd>18歳以上のPokerSummit先行会員</dd></div>
          <div><dt><Icon kind="trophy" />プライズ</dt><dd className={styles.prize}>総額30,000円保証</dd></div>
          <div><dt><Icon kind="diamond" />参加に必要なもの</dt><dd>m HOLD’EM ID・アプリ内ダイヤ</dd></div>
        </dl><p className={styles.note}>※プライズ配分・参加賞・必要ダイヤ数は後日発表します。</p></section>
        <aside className={styles.signup}><div className={styles.laurel}><svg className={styles.laurelArt} viewBox="0 0 150 110" aria-hidden="true"><path d="M52 99C22 86 14 47 34 18M98 99c30-13 38-52 18-81" fill="none" stroke="currentColor" strokeWidth="2" />{[0,1,2,3,4,5].map(i=><g key={i}><ellipse cx={27-i*.4} cy={29+i*11} rx="3.5" ry="9" transform={`rotate(${-35-i*7} ${27-i*.4} ${29+i*11})`} /><ellipse cx={36+i*1.5} cy={35+i*11} rx="3.5" ry="9" transform={`rotate(${30+i*8} ${36+i*1.5} ${35+i*11})`} /><ellipse cx={123+i*.4} cy={29+i*11} rx="3.5" ry="9" transform={`rotate(${35+i*7} ${123+i*.4} ${29+i*11})`} /><ellipse cx={114-i*1.5} cy={35+i*11} rx="3.5" ry="9" transform={`rotate(${-30-i*8} ${114-i*1.5} ${35+i*11})`} /></g>)}</svg><img src="/images/summit-finger-clean.webp" width="64" height="80" alt="" /></div><h2>会員登録受付中</h2><p>本大会は先行会員登録済みの方が対象です</p><Link className={styles.goldButton} href="/signup">会員登録</Link><a className={styles.darkButton} href={APP_URL} target="_blank" rel="noopener noreferrer">m HOLD’EMアプリを開く</a><Link className={styles.profile} href="/mypage">m HOLD’EM IDの登録・確認はこちら</Link></aside>
        <section id="how-to-join" className={`${styles.section} ${styles.full}`}><h2><span className={styles.headingIcon}><Icon kind="coins" /></span>参加までの流れ<small>HOW TO JOIN</small></h2><ol className={styles.steps}>{steps.map(([title, text], i) => <li key={title}><span className={styles.number}>{String(i + 1).padStart(2, "0")}</span><span className={styles.stepIcon}><Icon kind={(["document", "person", "diamond", "play"] as const)[i]} /></span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><p className={styles.note}>※ルーム情報・入室方法は開催前にご案内します。</p></section>
      </div>
      <section id="prize-claim" className={styles.claim}><h2><span className={styles.headingIcon}><Icon kind="gift" /></span>入賞後の賞品受け取り<small>PRIZE CLAIM</small></h2><ol className={styles.claimSteps}>
        <li><span className={styles.number}>1</span><span className={styles.claimIcon}><Icon kind="mail" /></span><div><h3>登録メールアドレスから<br />サイト運営にメール</h3><p>入賞された会員は、PokerSummitに登録したメールアドレスからサイト運営へメールをお送りください。m HOLD’EMアプリのマイページで、プレイヤー名とIDが1画面にセットで写っているスクリーンショットを添付してください。</p></div></li>
        <li><span className={styles.number}>2</span><span className={styles.claimIcon}><Icon kind="gift" /></span><div><h3>登録IDと照合後<br />賞品をお渡し</h3><p>お送りいただいたスクリーンショットのIDと、PokerSummitに登録されたm HOLD’EM IDを照合後、賞品をお渡しします。</p></div></li>
      </ol><div className={styles.claimReminder}>m HOLD’EMアプリのマイページで、プレイヤー名とIDが1画面にセットで写っているスクリーンショットをお送りください。</div><div className={styles.deadline}><strong>提出期限：<time dateTime="2026-11-01T23:59:00+09:00">2026年11月1日（日）23:59</time>（日本時間）</strong><p>期限を過ぎた場合や、登録したアドレス以外から送られた場合は、賞品をお渡しできません。</p></div></section>
      <section className={`${styles.section} ${styles.noticeSection}`}><h2><span className={styles.headingIcon} aria-hidden="true">!</span>注意事項<small>IMPORTANT NOTES</small></h2><ul className={styles.notes}><li>参加にはアプリ内アイテム（ダイヤ）が必要です。</li><li>登録したm HOLD’EM IDと参加IDを一致させてください。</li><li>通常の会員登録のみでは、本大会の参加対象となりません。</li><li>大会の最新情報・ルーム情報は開催前にご案内します。</li><li>本大会はPokerSummit主催です。サミー株式会社・m HOLD’EMの公認・協賛大会ではありません。</li></ul></section>
      <div className={styles.finalCta}><a className={styles.goldButton} href={APP_URL} target="_blank" rel="noopener noreferrer">大会に参加する</a><p>m HOLD’EM公式のアプリリンクへ移動します。</p></div>
    </main><footer className={styles.footer}><Link href="/"><img src="/images/logo.webp" alt="PokerSummit" /></Link></footer>
  </div>;
}

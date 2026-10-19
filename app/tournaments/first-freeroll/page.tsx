import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "第1回フリーロール 大会詳細｜PokerSummit",
  description: "2026年10月25日21時開催。PokerSummit先行会員限定フリーロールの参加方法・大会概要・入賞後の賞品受け取り方法をご案内します。",
  alternates: { canonical: "/tournaments/first-freeroll" },
};
// m HOLD’EM公式サイトのアプリ導線。独自の未確認URLスキームは使用しない。
const APP_URL = "https://app.adjust.com/egwr7v0";
const steps = [
  ["先行会員登録済みの会員", "先行会員登録を完了していることをご確認ください。本大会は先行会員登録済みの方が対象です。"],
  ["m HOLD’EM IDをマイページに登録", "PokerSummitのマイページで、ご自身のm HOLD’EM IDを登録してください。登録済みのIDはご自身では変更できません。"],
  ["アプリと必要なダイヤを準備", "m HOLD’EMアプリと、参加に必要なアプリ内アイテム（ダイヤ）をご準備ください。必要数は後日ご案内します。"],
  ["大会ルームに入室", "開催前にご案内するルーム情報・入室方法をご確認のうえ、指定の時間にご入室ください。"],
];
export default function FirstFreerollPage() {
  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="PokerSummit TOP"><img src="/images/logo.webp" alt="PokerSummit" /></Link><nav aria-label="大会ページメニュー"><a href="#overview">大会概要</a><a href="#how-to-join">参加方法</a><a href="#prize-claim">賞品受取</a></nav></header>
    <main className={styles.main}>
      <nav aria-label="パンくず" className={styles.breadcrumb}><Link href="/">TOP</Link><span>／</span><span>先行会員限定トーナメント</span></nav>
      <section className={styles.hero}>
        <div className={styles.heroCopy}><span className={styles.badge}>先行会員限定</span><img className={styles.logo} src="/images/logo.webp" alt="PokerSummit" width="400" height="120" /><h1>第1回フリーロール</h1><p>その挑戦権を、つかみ取れ</p></div>
        <div className={styles.date}><strong><time dateTime="2026-10-25T21:00:00+09:00">2026.10.25 SUN　21:00 START</time></strong><span>m HOLD’EMアプリで開催 · 日本時間</span></div>
      </section>
      <nav className={styles.anchors} aria-label="ページ内メニュー"><a href="#overview">大会概要</a><a href="#how-to-join">参加方法</a><a href="#prize-claim">賞品受取</a></nav>
      <div className={styles.columns}>
        <section id="overview" className={styles.section}><h2><span className={styles.headingIcon} aria-hidden="true">♠</span>大会概要<small>TOURNAMENT OVERVIEW</small></h2><dl className={styles.overview}>
          <div><dt>開催日時</dt><dd>2026年10月25日（日）21:00〜<small>※日本時間</small></dd></div>
          <div><dt>開催場所</dt><dd>m HOLD’EMアプリ</dd></div>
          <div><dt>参加対象</dt><dd>18歳以上のPokerSummit先行会員</dd></div>
          <div><dt>プライズ</dt><dd className={styles.prize}>総額30,000円保証</dd></div>
          <div><dt>参加に必要なもの</dt><dd>m HOLD’EM ID・アプリ内ダイヤ</dd></div>
        </dl><p className={styles.note}>※プライズ配分・参加賞・必要ダイヤ数は後日発表します。</p></section>
        <aside className={styles.signup}><img src="/images/summit-finger-clean.webp" width="64" height="80" alt="" /><h2>会員登録受付中</h2><p>本大会は先行会員登録済みの方が対象です</p><Link className={styles.goldButton} href="/signup">会員登録</Link><a className={styles.darkButton} href={APP_URL} target="_blank" rel="noopener noreferrer">m HOLD’EMアプリを開く</a><Link className={styles.profile} href="/mypage">m HOLD’EM IDの登録・確認はこちら</Link></aside>
        <section id="how-to-join" className={`${styles.section} ${styles.full}`}><h2><span className={styles.headingIcon} aria-hidden="true">▤</span>参加までの流れ<small>HOW TO JOIN</small></h2><ol className={styles.steps}>{steps.map(([title, text], i) => <li key={title}><span className={styles.number}>{String(i + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><p className={styles.note}>※ルーム情報・入室方法は開催前にご案内します。</p></section>
      </div>
      <section id="prize-claim" className={styles.claim}><h2><span className={styles.headingIcon} aria-hidden="true">♔</span>入賞後の賞品受け取り<small>PRIZE CLAIM</small></h2><ol className={styles.claimSteps}>
        <li><span className={styles.number}>1</span><span className={styles.claimIcon} aria-hidden="true">✉</span><div><h3>登録メールアドレスから<br />サイト運営にメール</h3><p>入賞された会員は、PokerSummitに登録したメールアドレスからサイト運営へメールをお送りください。m HOLD’EMアプリのマイページで、プレイヤー名とIDが1画面にセットで写っているスクリーンショットを添付してください。</p></div></li>
        <li><span className={styles.number}>2</span><span className={styles.claimIcon} aria-hidden="true">♔</span><div><h3>登録IDと照合後<br />賞品をお渡し</h3><p>お送りいただいたスクリーンショットのIDと、PokerSummitに登録されたm HOLD’EM IDを照合後、賞品をお渡しします。</p></div></li>
      </ol><div className={styles.claimReminder}>m HOLD’EMアプリのマイページで、プレイヤー名とIDが1画面にセットで写っているスクリーンショットをお送りください。</div><div className={styles.deadline}><strong>提出期限：<time dateTime="2026-11-01T23:59:00+09:00">2026年11月1日（日）23:59</time>（日本時間）</strong><p>期限を過ぎた場合や、登録したアドレス以外から送られた場合は、賞品をお渡しできません。</p></div></section>
      <section className={styles.section}><h2><span className={styles.headingIcon} aria-hidden="true">!</span>注意事項<small>IMPORTANT NOTES</small></h2><ul className={styles.notes}><li>参加にはアプリ内アイテム（ダイヤ）が必要です。</li><li>登録したm HOLD’EM IDと参加IDを一致させてください。</li><li>通常の会員登録のみでは、本大会の参加対象となりません。</li><li>大会の最新情報・ルーム情報は開催前にご案内します。</li><li>本大会はPokerSummit主催です。サミー株式会社・m HOLD’EMの公認・協賛大会ではありません。</li></ul></section>
      <div className={styles.finalCta}><a className={styles.goldButton} href={APP_URL} target="_blank" rel="noopener noreferrer">大会に参加する</a><p>m HOLD’EM公式のアプリリンクへ移動します。未インストールの場合はダウンロードしてご参加ください。</p></div>
    </main><footer className={styles.footer}><Link href="/"><img src="/images/logo.webp" alt="PokerSummit" /></Link></footer>
  </div>;
}

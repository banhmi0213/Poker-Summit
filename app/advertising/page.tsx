import Link from "next/link";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { staticPageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = staticPageMetadata({ title: "広告掲載のご案内", description: "Poker Summitの広告掲載をご案内します。PCはPICKUP下の大型バナー、スマートフォンは最上段に掲載。掲載内容・期間・料金についてお気軽にご相談ください。", path: "/advertising" });

function Finger() { return <img className={styles.finger} src="/images/summit-finger-clean.webp" alt="" />; }
function Placement({ mobile = false }: { mobile?: boolean }) {
  const ad = <div className={styles.adSlot}>広告掲載はココ！</div>;
  return <div className={styles.previewCard}>
    <h3>{mobile ? "スマートフォンでの表示" : "PCでの表示"}</h3>
    <div className={mobile ? styles.phone : styles.desktop}>
      <div className={styles.screenHeader}><img src="/images/logo.webp" alt="Poker Summit" /></div>
      {mobile && ad}
      <div className={styles.pickup}>PICKUP</div>
      <div className={styles.storeGrid}>{[0, 1, 2, 3].map(n => <div className={styles.storeCard} key={n}>
        <img className={styles.storePhoto} src="/images/poker-store-finder-banner.webp" alt="" />
        <img className={styles.storeLogo} src="/images/logo.webp" alt="店舗カードの表示例" />
      </div>)}</div>
      {!mobile && ad}
    </div>
    <p className={styles.caption}>{mobile ? "サイト最上段に掲載" : "PICKUPの下に大きく掲載"}</p>
  </div>;
}

export default function AdvertisingPage() {
  return <><PortalHeader />
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link><span aria-hidden="true">›</span>広告掲載のご案内</nav>
      <section className={styles.hero}>
        <div className={styles.heroCopy}><span className={styles.eyebrow}>ADVERTISING</span>
          <h1>ポーカーファンに<br />あなたの魅力を</h1>
          <p>Poker Summit 広告掲載のご案内</p>
          <a className={styles.button} href="#inquiry">広告掲載を相談する <span aria-hidden="true">→</span></a>
        </div>
        <div className={styles.heroShowcase} aria-hidden="true">
          <Placement /><Placement mobile />
        </div>
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}><Finger />広告掲載について</h2>
        <p className={styles.intro}>店舗・大会・サービスの情報を Poker Summitで発信しませんか</p>
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}><Finger />掲載イメージ</h2>
        <div className={styles.previews}><Placement /><Placement mobile /></div>
        <p className={styles.note}>※掲載イメージです 実際の表示は端末や画面サイズによって異なります</p>
      </section>
      <section className={styles.infoGrid} aria-label="掲載内容と料金">
        <div className={styles.infoCard}><h2>掲載できる内容</h2><p>ポーカー店舗・大会・関連サービスなど</p><p>掲載内容は事前に確認いたします</p></div>
        <div className={styles.infoCard}><h2>掲載期間・料金</h2><p><strong>掲載料金はお問い合わせください</strong></p><p>ご希望の掲載期間・内容に合わせてご案内します</p></div>
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}><Finger />掲載までの流れ</h2>
        <ol className={styles.steps}>{[
          ["お問い合わせ", "ご希望の掲載内容や期間をフォームからお知らせください"],
          ["内容・料金のご案内", "掲載内容を確認し 料金と掲載期間をご案内します"],
          ["広告素材のご提出", "バナー画像やリンク先など 必要な素材をご提出いただきます"],
          ["掲載開始", "内容と掲載条件の確認後 広告を掲載します"],
        ].map(([title, text], i) => <li key={title}><span>{i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol>
      </section>
      <section id="inquiry" className={styles.inquiry}>
        <Finger /><h2>広告掲載をご検討の方へ</h2><p>まずはお気軽にご相談ください</p>
        <Link className={styles.button} href="/contact?category=advertising">広告掲載を相談する <span aria-hidden="true">→</span></Link>
        <p className={styles.note}>広告掲載専用のお問い合わせフォームへ進みます</p>
      </section>
    </main><PortalFooter /><BottomTabs /></>;
}

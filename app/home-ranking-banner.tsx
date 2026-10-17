import Link from "next/link";
import styles from "./home-ranking-banner.module.css";
import { nameTitleLines, nameWidth } from "@/lib/name-layout";

export function HomeRankingBanner({ stores }: { stores: { id: string; name: string }[] }) {
  return <div className={styles.banner} aria-label="店舗ランキング 上位3店舗">
    <Link className={styles.artwork} href="/stores/ranking"><img src="/images/ranking-banner-light-v1.webp" alt="店舗ランキング 人気のポーカースポットをチェック" width={2146} height={229} loading="lazy" /></Link>
    <div className={styles.mobileHeading}><Link href="/stores/ranking">店舗ランキング <span>TOP 3</span></Link></div>
    <ol className={styles.names}>{stores.slice(0, 3).map((store, index) => {
      const lines = nameTitleLines(store.name, 18);
      const size = Math.min(1.04, 18 / Math.max(...lines.map(nameWidth), 1));
      return <li key={store.id}><Link href={`/stores/${store.id}`} aria-label={`${index + 1}位 ${store.name}`} title={store.name} style={{ fontSize: `${size}cqw` }}><b className={styles.rankNumber}>{index + 1}</b>{lines.map((line, i) => <span className={styles.line} key={i}>{line}</span>)}</Link></li>;
    })}</ol>
  </div>;
}

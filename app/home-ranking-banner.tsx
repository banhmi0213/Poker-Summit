import Link from "next/link";
import styles from "./home-ranking-banner.module.css";

export function HomeRankingBanner({ stores }: { stores: { id: string; name: string }[] }) {
  return <div className={styles.banner} aria-label="店舗ランキング 上位3店舗">
    <Link className={styles.artwork} href="/stores/ranking"><img src="/images/ranking-banner-light-v1.webp" alt="店舗ランキング 人気のポーカースポットをチェック" width={2146} height={229} loading="lazy" /></Link>
    <ol className={styles.names}>{stores.slice(0, 3).map((store, index) => <li key={store.id}><Link href={`/stores/${store.id}`} aria-label={`${index + 1}位 ${store.name}`} title={store.name}>{store.name}</Link></li>)}</ol>
  </div>;
}

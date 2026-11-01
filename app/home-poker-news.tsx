import { getHomePokerNews } from "@/lib/poker-news";
import { HomeNewsFeed } from "./poker-news/home-feed";
import Link from "next/link";
import styles from "./home-poker-news.module.css";

export async function HomePokerNews() {
 const feed=await getHomePokerNews().catch(()=>null);
 const latestDate=feed?.entries[0]?.news_date;
 return <section className={styles.section} aria-labelledby="home-poker-news-heading">
  <header className={styles.header}><span>POKER SUMMIT NEWS</span><h2 id="home-poker-news-heading"><span aria-hidden="true">📰</span> ポーカーニュース</h2><p>大会の話題から注目の情報まで、気になるニュースをひと目で。</p></header>
  <article className={styles.feature}>
   <div className={styles.visual}><img src="/images/poker-news-navy-v1.webp" alt="" width={960} height={540} loading="lazy" decoding="async" /></div>
   <div className={styles.featureCopy}><div className={styles.featureMeta}><span>ニュースまとめ</span>{latestDate&&<time dateTime={latestDate}>{latestDate.replaceAll("-",".")} 更新</time>}</div><h3>国内外のポーカーニュース<br/>注目の話題をまとめてチェック</h3><p>日本人選手の活躍や大会の開催情報など、最新のニュースをわかりやすくお届けします。</p><Link href="/poker-news">ニュースまとめを読む</Link></div>
  </article>
  {feed ? <HomeNewsFeed entries={feed.entries} count={feed.count}/> : <p>ニュースを読み込めませんでした。時間をおいて再度ご確認ください。</p>}
 </section>;
}

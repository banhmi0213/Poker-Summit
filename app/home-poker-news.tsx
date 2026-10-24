import Link from "next/link";
import styles from "./home-poker-news.module.css";

// Initial editorial snapshot for reviewing the layout. Independent news management
// and publication dates will replace this data when the registration flow is added.
const news = [
 {category:"業界情報",title:"JPBAが警察庁の講話を開催。店舗運用ガイドラインは10月31日公表予定",summary:"JPBAが10月23日の講話開催を報告。店舗運営に関する案内を、発表元の情報とあわせて確認できます。",source:"https://prtimes.jp/main/html/rd/p/000000001.000193356.html",label:"発表元を見る"},
 {category:"大会結果",title:"岡本詩菜選手が台湾TMTCのSuper High Rollerで準優勝",summary:"台湾のTMT Championship 2026での活躍を紹介。大会の結果投稿から詳細を確認できます。",source:"https://x.com/tmtjp2026/status/2113688779018158231",label:"公式Xを見る"},
 {category:"国内大会",title:"GO KAGOSHIMAは11月12〜15日予定。遠征前に公式日程を確認",summary:"会場はライカ南国ホール。参加したい種目や受付条件は、主催者の最新案内をご確認ください。",source:"https://nippon-series.jp/",label:"公式情報を見る"},
 {category:"海外大会",title:"Tritonが北キプロス大会の全日程を発表。11月に2シリーズを開催予定",summary:"Triton ONEとSuper High Roller Seriesを連続開催予定。各シリーズの種目・日程は公式発表へ。",source:"https://tritonpokerseries.com/en-US/news/headlines/full-schedule-revealed-for-triton-poker-series-return-to-northern-cyprus",label:"公式情報を見る"},
];

export function HomePokerNews() {
 return <section className={styles.section} aria-labelledby="home-poker-news-heading">
  <header className={styles.header}><span>POKER SUMMIT NEWS</span><h2 id="home-poker-news-heading"><span aria-hidden="true">📰</span> ポーカーニュース</h2><p>大会の話題から注目の情報まで、気になるニュースをひと目で。</p></header>
  <article className={styles.feature}>
   <div className={styles.visual}><img src="/images/poker-news-navy-v1.webp" alt="" width={960} height={540} loading="lazy" decoding="async" /></div>
   <div className={styles.featureCopy}><div className={styles.featureMeta}><span>ニュースまとめ</span><time dateTime="2026-10-23">2026.10.23 収集分</time></div><h3>国内外のポーカーニュース<br/>注目の話題をまとめてチェック</h3><p>日本人選手の活躍や大会の開催情報など、収集したニュースをわかりやすくお届けします。</p><Link href="/blog/poker-news-20261023">ニュースまとめを読む</Link></div>
  </article>
  <ul className={styles.list}>{news.map(item=><li key={item.source} className={styles.row}><article><div className={styles.meta}><span>{item.category}</span><time dateTime="2026-10-23">2026.10.23 収集分</time></div><h3>{item.title}</h3><p>{item.summary}</p></article><a className={styles.source} href={item.source} target="_blank" rel="noopener noreferrer">{item.label}<span className={styles.srOnly}>（別タブで開きます）</span></a></li>)}</ul>
  <footer className={styles.footer}><p>表示確認用：収集済み情報を掲載しています。</p><Link href="/blog/poker-news-20261023">ニュースまとめを読む</Link></footer>
 </section>;
}

import Link from "next/link";
import styles from "./learn-hub.module.css";

/** GTO・学習 (owner 2026/11/1): the free tools that need no sign-up, above the lessons. The member's own analysis
 * (弱点分析 and the rest) lives on the player page; the last card points there. */
const TOOLS=[
 {href:"/learn/preflop/btn",label:"プリフロップ表",text:"6人卓・100BBで、ポジションごとに参加する手・降りる手の割合。"},
 {href:"/learn/gto-quiz",label:"毎日のGTOクイズ",text:"計算済みの場面から1日1問。答えと理由がすぐわかります。"},
 {href:"/learn/icm-calculator",label:"ICM計算機",text:"大会の終盤、順位ごとの取り分を考えたオールイン・コールの範囲。"},
 {href:"/learn/river-solver",label:"リバー計算機",text:"リバーの2人勝負を計算して、手札ごとの正解の打ち方を確認。"},
] as const;

export function LearnTools(){
 return <section id="tools" className={styles.tools} aria-labelledby="learn-tools-title">
  <div className={styles.head}><span className={styles.eyebrow}>FREE TOOLS</span><h2 id="learn-tools-title">登録なしで使えるGTOツール</h2></div>
  <div className={styles.grid}>{TOOLS.map(t=><Link key={t.href} href={t.href} className={styles.card}><strong>{t.label}</strong><span>{t.text}</span></Link>)}</div>
 </section>;
}

export function LearnLessonsHeading(){
 return <div className={styles.head} id="lessons"><span className={styles.eyebrow}>LESSONS</span><h2>基本から順番に学ぶレッスン</h2><p>ルール・ポジションから、期待値・GTO・ソルバーの読み方まで。Lv.1〜4を順番に進めます。</p></div>;
}

export function LearnPlayerPage(){
 return <section className={styles.player} aria-labelledby="learn-player-title">
  <div><span className={styles.eyebrow}>PLAYER PAGE</span><h2 id="learn-player-title">打ったハンドから、自分の弱点を見つける</h2>
   <p>会員になると、リングや練習卓で打った判断を全部GTOと比べて、損が大きかった場面から並べます（弱点分析）。GTOと対戦やレンジ練習も使えます。</p></div>
  <Link href="/mypage/poker" className={styles.button}>プレイヤーページを開く</Link>
 </section>;
}

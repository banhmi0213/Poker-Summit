import Link from "next/link";
import styles from "./academy-hero.module.css";

export function AcademyHero({variant="home",courseLevel="beginner"}:{variant?:"home"|"course";courseLevel?:"beginner"|"level3"|"level4"}){
 const course=variant==="course";
 const Heading=course?"h1":"h2";
 return <section id={course?"academy-course-hero":"home-academy-hero"} className={`${styles.hero} ${course?styles.course:styles.home}`} aria-labelledby={course?"academy-course-heading":"home-academy-heading"}>
  <div className={styles.visual}><img src="/images/academy-learning-hero-v1.webp" alt="" width={1800} height={639} loading={course?"eager":"lazy"} decoding="async"/></div>
  <div className={styles.copy}>
   <div className={styles.meta}><span className={styles.eyebrow}>{course?"GTO・学習":"POKER SUMMIT ACADEMY"}</span><span className={styles.badge}>{course?"登録なしで無料":"無料で学べる"}</span></div>
   <Heading id={course?"academy-course-heading":"home-academy-heading"} className={styles.headline}>{course?<><span>表と計算機とレッスンで、</span><span>GTOを身につけよう。</span></>:<><span>遊びながら、</span><span>ポーカーを学ぼう。</span></>}</Heading>
   <p className={styles.description}>{course?"表・計算機・クイズ・レッスンが、登録なしで無料。":"ポジション・レンジ表・役の強さクイズを無料で体験。"}</p>
   <Link className={styles.cta} href={course?"#tools":"/learn"}>{course?"無料ツールを見る":"無料学習コースへ"}</Link>
   {course&&<ul className={styles.pills} aria-label="学習コースの特徴"><li>登録不要</li><li>{courseLevel==="level4"?"6レッスン＋戦略・確率テスト":courseLevel==="level3"?"6レッスン＋実戦判断テスト":"5レッスン＋卒業テスト"}</li><li>スマホ対応</li></ul>}
  </div>
 </section>;
}

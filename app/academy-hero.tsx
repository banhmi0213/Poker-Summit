import Link from "next/link";
import styles from "./academy-hero.module.css";

export function AcademyHero({variant="home"}:{variant?:"home"|"course"}){
 const course=variant==="course";
 const Heading=course?"h1":"h2";
 return <section id={course?"academy-course-hero":"home-academy-hero"} className={`${styles.hero} ${course?styles.course:styles.home}`} aria-labelledby={course?"academy-course-heading":"home-academy-heading"}>
  <div className={styles.visual}><img src="/images/academy-learning-hero-v1.webp" alt="" width={1800} height={639} loading={course?"eager":"lazy"} decoding="async"/></div>
  <div className={styles.copy}>
   <div className={styles.meta}><span className={styles.eyebrow}>POKER SUMMIT ACADEMY</span><span className={styles.badge}>無料で学べる</span></div>
   <Heading id={course?"academy-course-heading":"home-academy-heading"} className={styles.headline}><span>遊びながら、</span><span>ポーカーを学ぼう。</span></Heading>
   <p className={styles.description}>{course?"カードを選び、考えて、クイズに挑戦。はじめての方も、自分のペースで学べる体験型コースです。":"ポジション・レンジ表・役の強さクイズを無料で体験。"}</p>
   <Link className={styles.cta} href={course?"#academy-lessons":"/learn"}>{course?"レッスンを始める":"無料学習コースへ"}</Link>
   {course&&<ul className={styles.pills} aria-label="学習コースの特徴"><li>登録不要</li><li>5レッスン＋卒業テスト</li><li>スマホ対応</li></ul>}
  </div>
 </section>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PositionTrainer } from "@/app/blog/position-trainer";
import { PreflopRangeTrainer } from "@/app/blog/preflop-range-trainer";
import { HandStrengthQuiz } from "@/app/blog/hand-strength-quiz";
import { PotOddsTrainer } from "./pot-odds-trainer";
import { PreflopDecisionSimulator } from "./preflop-decision-simulator";
import { GraduationTest } from "./graduation-test";
import styles from "./learn.module.css";

const storageKey = "poker-summit-academy-v1";
const lessons = [
 { id: "position", number: "01", title: "ポジションを覚える", subtitle: "6人テーブルの席・行動順・特徴を学ぶ", article: "/blog/poker-position-beginners", Component: PositionTrainer },
 { id: "range", number: "02", title: "プリフロップレンジを学ぶ", subtitle: "169種類のハンドから参加判断の基本を学ぶ", article: "/blog/poker-preflop-range-beginners", Component: PreflopRangeTrainer },
 { id: "hands", number: "03", title: "役の強さ・勝敗判定に挑戦", subtitle: "10問のクイズで役とキッカーを理解する", article: "/blog/poker-beginner-texas-holdem", Component: HandStrengthQuiz },
 { id: "potodds", number: "04", title: "ポットオッズを計算する", subtitle: "必要勝率とドローの完成確率を比較する", article: null, Component: PotOddsTrainer },
 { id: "decision", number: "05", title: "プリフロップ判断シミュレーター", subtitle: "手札・ポジション・相手のアクションから判断する", article: "/blog/poker-preflop-range-beginners", Component: PreflopDecisionSimulator },
 { id: "graduation", number: "06", title: "初心者卒業テスト", subtitle: "15問の総合テストで学習成果を確認する", article: null, Component: GraduationTest }
] as const;
type LessonId = Exclude<typeof lessons[number]["id"], "graduation">;
const courseLessons = lessons.filter(l => l.id !== "graduation");
const upcoming = ["学習レベル・バッジ・修了証", "会員別の学習履歴とランキング"];

export function Academy() {
 const [completed, setCompleted] = useState<LessonId[]>([]);
 const [selected, setSelected] = useState<typeof lessons[number]["id"]>("position");
 const [loaded, setLoaded] = useState(false);
 useEffect(() => {
  try {
   const raw = localStorage.getItem(storageKey);
   if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) setCompleted(parsed.filter((x): x is LessonId => courseLessons.some(l => l.id === x)));
   }
  } catch { /* Ignore blocked or invalid local storage. */ }
  setLoaded(true);
 }, []);
 function markComplete(id: LessonId) {
  const next = completed.includes(id) ? completed.filter(x => x !== id) : [...completed, id];
  setCompleted(next);
  try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Browsers may disable storage. */ }
 }
 const active = lessons.find(l => l.id === selected)!;
 const index = lessons.findIndex(l => l.id === selected);
 const percent = Math.round(completed.length / courseLessons.length * 100);
 return <div className={styles.academy}>
  <section className={styles.hero}>
   <span className={styles.eyebrow}>POKER SUMMIT ACADEMY</span>
   <h1>遊びながら、ポーカーが上達する。</h1>
   <p>カードを選び、考えて、クイズに挑戦。はじめての方も自分のペースで学べる、無料の体験型コースです。</p>
   <div className={styles.heroPills}><span>♠ 登録不要</span><span>✦ 全5レッスン</span><span>♥ スマホ対応</span></div>
  </section>
  <section className={styles.progressPanel} aria-label="学習進捗">
   <div><span className={styles.eyebrow}>YOUR LEARNING JOURNEY</span><h2>初心者コース</h2><p>{loaded ? `${completed.length} / 5 レッスンを学習済みに設定` : "学習状況を読み込み中"}</p></div>
   <div className={styles.progressRight}><strong>{loaded ? percent : 0}<small>%</small></strong><div className={styles.track}><span style={{width: (loaded ? percent : 0) + "%"}}/></div></div>
  </section>
  <div className={styles.layout}>
   <nav className={styles.lessonNav} aria-label="レッスンを選ぶ">
    <h2>LEARNING PATH <small>レッスン一覧</small></h2>
    {lessons.map(l => <button key={l.id} type="button" className={selected === l.id ? styles.lessonActive : styles.lesson} aria-current={selected === l.id ? "step" : undefined} onClick={() => setSelected(l.id)}>
      <span className={styles.lessonNumber}>{l.number}</span><span className={styles.lessonText}><strong>{l.title}</strong><small>{l.subtitle}</small></span><span className={styles.check}>{loaded && completed.includes(l.id as LessonId) ? "✓" : "›"}</span>
     </button>)}
    <p className={styles.storageNote}>学習済みのチェックは、このブラウザ内に保存されます。卒業テストの採点とは連動しません。</p>
   </nav>
   <section className={styles.lessonMain} aria-labelledby="current-lesson-title">
    <div className={styles.lessonIntro}><span className={styles.eyebrow}>LESSON {active.number}</span><h2 id="current-lesson-title">{active.title}</h2><p>{active.subtitle}</p>{active.article && <Link href={active.article}>詳しい解説記事を読む ↗</Link>}</div>
    <active.Component />
    <div className={styles.lessonFooter}>{active.id !== "graduation" && <button type="button" className={styles.completeButton} aria-pressed={completed.includes(active.id as LessonId)} onClick={() => markComplete(active.id as LessonId)}>{completed.includes(active.id as LessonId) ? "✓ 学習済みを解除" : "✓ このレッスンを学習済みにする"}</button>}
      {index < lessons.length - 1 && <button type="button" className={styles.nextButton} onClick={() => { setSelected(lessons[index + 1].id); document.getElementById("current-lesson-title")?.scrollIntoView({behavior:"smooth",block:"start"}); }}>次のレッスンへ →</button>}</div>
   </section>
  </div>
  {loaded && completed.length === courseLessons.length && <section className={styles.congrats} role="status"><span>✦ COURSE COMPLETE ✦</span><h2>初心者コース、学習完了！</h2><p>5つのレッスンをすべて学習済みにしました。次は実戦で判断する練習へ進みましょう。</p><small>※現在は自己申告による学習完了表示です。公式の認定・修了証ではありません。</small></section>}
  <section className={styles.future}><span className={styles.eyebrow}>COMING NEXT</span><h2>これから増える学習コンテンツ</h2><p>ポーカーの判断力を磨く、次のステップを順次制作予定です。</p><div className={styles.futureGrid}>{upcoming.map(name => <div key={name}><span>✧</span><strong>{name}</strong><small>今後公開予定</small></div>)}</div></section>
 </div>;
}

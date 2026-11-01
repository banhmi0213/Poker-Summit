"use client";

import { useState } from "react";
import type { PracticeQuestion } from "./level-three-content";
import styles from "./level-three.module.css";

export function LessonQuiz({ questions, exam = false, level = 3, examTitle = "実戦判断テスト", passScore = 10, onFinish }: {
 questions: readonly PracticeQuestion[]; exam?: boolean; level?: number; examTitle?: string; passScore?: number; onFinish: (score: number) => void;
}) {
 const [index, setIndex] = useState(0);
 const [answers, setAnswers] = useState<number[]>([]);
 const [finished, setFinished] = useState(false);
 const question = questions[index];
 const selected = answers[index];
 const score = questions.reduce((total, item, i) => total + (answers[i] === item.answer ? 1 : 0), 0);
 function next() {
  if (selected === undefined) return;
  if (index === questions.length - 1) { setFinished(true); onFinish(score); }
  else setIndex(value => value + 1);
  requestAnimationFrame(() => document.getElementById(`level${level}-question-title`)?.focus());
 }
 return <section className={styles.quiz} aria-label={exam ? `Lv.${level}${examTitle}` : "理解度チェック"}>
  <div className={styles.sectionHead}><h3>{exam ? examTitle : `${questions.length}問で理解度チェック`}</h3><span>{finished ? "結果" : `${index + 1} / ${questions.length}`}</span></div>
  {finished ? <div className={styles.result}>
   <div role="status"><h4 id={`level${level}-question-title`} tabIndex={-1}>{score} / {questions.length} 問正解</h4><p>{exam ? (score >= passScore ? "合格です。状況と理由を結びつける基本を確認できました。" : "解説を復習して、もう一度挑戦しましょう。") : "全問の解説を確認しました。間違えた問題も見直して、学習済みにできます。"}</p></div>
   {exam && <p className={styles.note}>この結果はブラウザ内の学習記録です。会員レベル・公式バッジの付与とは連動しません。</p>}
   <details><summary>回答と解説を振り返る</summary><ol className={styles.reviewList}>{questions.map((item, i) => <li key={item.id}><strong>{answers[i] === item.answer ? "正解" : "復習"}：{item.question}</strong><p>{item.situation}</p><p>あなたの回答：{item.choices[answers[i]]}</p><p>正解：{item.choices[item.answer]}</p><p>{item.explanation}</p></li>)}</ol></details>
   <button type="button" onClick={() => { setIndex(0); setAnswers([]); setFinished(false); }}>もう一度挑戦する</button>
  </div> : <>
   <p className={styles.topic}>{question.topic}</p><p className={styles.situation}>{question.situation}</p><h4 id={`level${level}-question-title`} tabIndex={-1}>{question.question}</h4>
   <div className={styles.choices}>{question.choices.map((choice, i) => <button key={choice} type="button" disabled={selected !== undefined} aria-pressed={selected === i} onClick={() => setAnswers(previous => previous.length === index ? [...previous, i] : previous)}>{choice}</button>)}</div>
   {selected !== undefined && <div className={styles.feedback}><div role="status"><strong>{selected === question.answer ? "正解" : "復習ポイント"}：{question.choices[question.answer]}</strong><p>{question.explanation}</p></div><button type="button" onClick={next}>{index === questions.length - 1 ? "結果を見る" : "次の問題へ"}</button></div>}
  </>}
 </section>;
}


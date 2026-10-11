"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./preflop-range-trainer.module.css";

type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB";
type Hand = { key: string; kind: "pair" | "suited" | "offsuit" };
const ranks = "AKQJT98765432".split("");
const rankIndex = (rank: string) => ranks.indexOf(rank);
const handAt = (row: number, col: number): Hand => row === col
  ? { key: ranks[row] + ranks[col], kind: "pair" }
  : row < col
    ? { key: ranks[row] + ranks[col] + "s", kind: "suited" }
    : { key: ranks[col] + ranks[row] + "o", kind: "offsuit" };

function expand(token: string): string[] {
 const plus = token.endsWith("+");
 const base = plus ? token.slice(0, -1) : token;
 const a = base[0], b = base[1], suffix = base[2] || "";
 if (!plus) return [base];
 if (a === b) return ranks.slice(0, rankIndex(a) + 1).map(r => r + r);
 // E.g. ATs+ means ATs, AJs, AQs, AKs (not lower-ranked hands).
 return ranks.slice(rankIndex(b), rankIndex(a)).map(r => a + r + suffix);
}
const definitions: Record<Position, { label: string; desc: string; tokens: string }> = {
 UTG: { label: "アーリー", desc: "後ろに5人が残るため、強いハンドを中心に参加する例です。", tokens: "77+ ATs+ KQs KJs QJs JTs AQo+ KQo" },
 HJ: { label: "ミドル", desc: "UTGより参加候補を少し増やす例です。", tokens: "66+ A8s+ KTs+ QTs+ JTs T9s AJo+ KQo" },
 CO: { label: "レイト", desc: "後続が3人になり、スーテッドや中程度のハンドも増やす例です。", tokens: "44+ A2s+ K8s+ Q9s+ J9s+ T8s+ 98s 87s ATo+ KJo+ QJo" },
 BTN: { label: "レイト", desc: "ポストフロップで通常最後に行動できるため、最も幅広い候補を示しています。", tokens: "22+ A2s+ K2s+ Q5s+ J7s+ T7s+ 97s+ 86s+ 76s 65s A2o+ K8o+ Q9o+ J9o+ T9o" },
 SB: { label: "ブラインド", desc: "全員フォールドでSBまで回った場合の、レイズ参加を簡略化した例です。", tokens: "22+ A2s+ K5s+ Q7s+ J8s+ T8s+ 98s 87s 76s A2o+ K9o+ QTo+ JTo" }
};
const ranges = Object.fromEntries(Object.entries(definitions).map(([position, d]) =>
 [position, new Set(d.tokens.split(" ").flatMap(expand))]
)) as Record<Position, Set<string>>;
const questions: { position: Position; hand: string }[] = [
 { position: "UTG", hand: "AKs" },
 { position: "UTG", hand: "54o" },
 { position: "HJ", hand: "A9s" },
 { position: "CO", hand: "76o" },
 { position: "BTN", hand: "K4s" }
];
const descriptions: Record<Hand["kind"], string> = {
 pair: "ポケットペア：同じ数字の2枚",
 suited: "スーテッド：同じマークの2枚",
 offsuit: "オフスート：異なるマークの2枚"
};

export function PreflopRangeTrainer() {
 const [position, setPosition] = useState<Position>("UTG");
 const [selected, setSelected] = useState<Hand>(handAt(0, 1));
 const [questionIndex, setQuestionIndex] = useState(0);
 const [answer, setAnswer] = useState<boolean | null>(null);
 const [score, setScore] = useState(0);
 const [finished, setFinished] = useState(false);
 const activeRange = ranges[position];
 const selectedIncluded = activeRange.has(selected.key);
 const totalCombos = Array.from({ length: 13 }, (_, row) =>
   Array.from({ length: 13 }, (_, col) => handAt(row, col))
 ).flat().reduce((sum, h) => sum + (activeRange.has(h.key) ? h.kind === "pair" ? 6 : h.kind === "suited" ? 4 : 12 : 0), 0);
 const percent = (totalCombos / 1326 * 100).toFixed(1);
 const question = questions[questionIndex];
 const correct = ranges[question.position].has(question.hand);
 function choose(value: boolean) {
  if (answer !== null) return;
  setAnswer(value);
  if (value === correct) setScore(prev => prev + 1);
 }
 function next() {
  if (questionIndex === questions.length - 1) { setFinished(true); return; }
  setQuestionIndex(i => i + 1); setAnswer(null);
 }
 function restart() { setQuestionIndex(0); setAnswer(null); setScore(0); setFinished(false); }
 return <section className={styles.trainer} aria-labelledby="preflop-range-title">
  <header className={styles.header}>
   <span className={styles.eyebrow}>POKER SUMMIT · INTERACTIVE LESSON</span>
   <h2 id="preflop-range-title">触って学ぶ、プリフロップレンジ</h2>
   <p>ポジションを切り替えて、169種類のスターティングハンドを比べてみましょう。</p>
  </header>
  <div className={styles.tabs} role="group" aria-label="ポジションを選ぶ">
   {(Object.keys(definitions) as Position[]).map(p =>
    <button key={p} type="button" className={p === position ? styles.tabActive : styles.tab} aria-pressed={p === position}
      onClick={() => { setPosition(p); setSelected(handAt(0, 1)); }}>{p}</button>
   )}
  </div>
  <div className={styles.layout}>
   <div className={styles.matrixPanel}>
    <div className={styles.matrixHeading}><strong>{position} の参考レンジ</strong><span>{percent}% <small>（{totalCombos}/1326コンボ）</small></span></div>
    <div className={styles.matrix} role="group" aria-label={position + " の13×13ハンド表"}>
     {ranks.map((_, row) => ranks.map((__, col) => {
      const hand = handAt(row, col);
      const included = activeRange.has(hand.key);
      return <button type="button" key={hand.key}
        className={[styles.cell, included ? styles.inRange : styles.outRange, hand.kind === "pair" ? styles.pair : "", selected.key === hand.key ? styles.selected : ""].join(" ")}
        aria-pressed={selected.key === hand.key}
        aria-label={hand.key + "、" + descriptions[hand.kind] + "、" + (included ? "参加候補" : "参加候補外")}
        title={hand.key + " · " + (included ? "参加候補" : "参加候補外")}
        onClick={() => setSelected(hand)}>{hand.key}</button>;
     }))}
    </div>
    <div className={styles.legend}><span><i className={styles.legendIn}/>参考レンジに含む</span><span><i className={styles.legendOut}/>含まない</span><span><i className={styles.legendSelected}/>選択中</span></div>
   </div>
   <aside className={styles.detail} aria-live="polite">
    <span className={styles.positionLabel}>{definitions[position].label}ポジション</span>
    <h3>{position} <small>の参加ハンド</small></h3>
    <p>{definitions[position].desc}</p>
    <div className={styles.handInfo}>
     <span>選択したハンド</span><strong>{selected.key}</strong>
     <p>{descriptions[selected.kind]}</p>
     <div className={selectedIncluded ? styles.included : styles.excluded}>{selectedIncluded ? "参考レンジに含まれます" : "参考レンジには含まれません"}</div>
     <p className={styles.explain}>{selectedIncluded
       ? "このポジションから最初にレイズして参加する候補として掲載しています。"
       : "この簡易レンジでは、最初のレイズ参加候補に含めていません。常にフォールドが正解という意味ではありません。"}</p>
    </div>
    <div className={styles.tip}><strong>レンジ表の読み方</strong><p>対角線はペア、右上はスーテッド（s）、左下はオフスート（o）です。色の付いたマスをタップして確認しましょう。</p></div>
   </aside>
  </div>
  <div className={styles.quiz}>
   <div className={styles.quizHeader}><div><span className={styles.eyebrow}>QUICK CHALLENGE</span><h3>5問でレンジをチェック</h3></div><span>{finished ? "結果" : (questionIndex + 1) + " / " + questions.length}</span></div>
   {finished ? <div className={styles.result} role="status"><strong>{score} / {questions.length} 問正解！</strong><p>{score === questions.length ? "全問正解です！参考レンジの基本を理解できています。" : "上の表で各ハンドを確認して、もう一度挑戦しましょう。"}</p><button type="button" onClick={restart}>もう一度挑戦する ↻</button></div>
   : <><p className={styles.question}>「{question.position}」で「{question.hand}」は、この参考レンジに含まれる？</p>
     <div className={styles.answers}><button type="button" disabled={answer !== null} onClick={() => choose(true)}>含まれる</button><button type="button" disabled={answer !== null} onClick={() => choose(false)}>含まれない</button></div>
     {answer !== null && <div className={styles.feedback} role="status"><strong>{answer === correct ? "正解！" : "惜しい！"} 正解は「{correct ? "含まれる" : "含まれない"}」です。</strong><p>この教材で設定した{question.position}の参考レンジに、{question.hand}は{correct ? "含まれています" : "含まれていません"}。表のポジションを切り替えて確認してみましょう。</p><button type="button" onClick={next}>{questionIndex === questions.length - 1 ? "結果を見る →" : "次の問題へ →"}</button></div>}
    </>}
  </div>
  <p className={styles.note}>※6人制テキサスホールデム、100BB前後、アンティなし、前のプレイヤーが全員フォールドした場面の「最初にレイズする参考例」です。GTO最適解や実戦での保証された推奨レンジではありません。SBは簡略化したレイズ例です。BBはこの状況では最初にレイズする立場ではないため対象外です。実際の判断はスタック・レーキ・相手・大会形式などで変わります。</p>
  <Link href="/blog/poker-position-beginners" className={styles.related}>ポジションの基本から復習する →</Link>
 </section>;
}

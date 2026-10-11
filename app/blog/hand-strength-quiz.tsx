"use client";

import { useState } from "react";
import styles from "./hand-strength-quiz.module.css";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = `${string}${Suit}`;
type Winner = "A" | "B" | "引き分け";
type Scenario = { title: string; board: Card[]; a: Card[]; b: Card[]; winner: Winner; explanation: string };
const questions: Scenario[] = [
 { title:"ワンペア対ツーペア",board:["A♠","9♥","5♣","2♦","K♠"],a:["A♦","Q♣"],b:["9♣","5♥"],winner:"B",explanation:"AはAのワンペア、Bは9と5のツーペア。ツーペアが勝ちます。" },
 { title:"同じワンペアなら？",board:["K♠","K♥","7♦","4♣","2♠"],a:["A♣","Q♦"],b:["A♥","J♣"],winner:"A",explanation:"どちらもKのワンペア。AとBのキッカーを順番に比べると、Qを持つAがJを持つBに勝ちます。" },
 { title:"ストレートを見つけよう",board:["8♣","9♦","T♥","2♠","K♣"],a:["J♠","Q♦"],b:["K♥","A♣"],winner:"A",explanation:"Aは8・9・T・J・Qのストレート。BのKのワンペアより強い役です。" },
 { title:"フラッシュとストレート",board:["2♥","5♥","8♥","9♣","T♦"],a:["K♥","A♥"],b:["J♠","Q♣"],winner:"A",explanation:"Aはハート5枚でフラッシュ。Bは8・9・T・J・Qのストレートなので、フラッシュが勝ちます。" },
 { title:"フルハウス対フラッシュ",board:["Q♠","Q♦","7♠","7♥","2♠"],a:["Q♥","3♣"],b:["A♠","K♠"],winner:"A",explanation:"AはQが3枚と7が2枚のフルハウス。Bはスペードのフラッシュですが、フルハウスが勝ちます。" },
 { title:"ボードだけで決まる役",board:["A♠","K♦","Q♣","J♥","T♠"],a:["2♥","3♥"],b:["8♣","9♣"],winner:"引き分け",explanation:"共通カードだけで全員がAハイのストレートを作れます。手札を使う必要はなく、引き分けです。" },
 { title:"同じツーペアのキッカー",board:["A♠","A♦","8♣","8♥","3♠"],a:["K♣","2♣"],b:["Q♠","J♣"],winner:"A",explanation:"どちらもAと8のツーペア。5枚目のKがQより強いため、Aが勝ちます。" },
 { title:"Aは低いストレートにもなる",board:["2♣","3♦","4♠","9♥","K♣"],a:["A♥","5♠"],b:["K♦","K♥"],winner:"B",explanation:"AはA・2・3・4・5のストレートですが、BはKが3枚のスリーカード。ストレートの方が強いのでAが勝ちます。" },
 { title:"フラッシュの比較",board:["A♠","J♠","7♠","3♠","2♦"],a:["K♠","4♦"],b:["Q♠","9♥"],winner:"A",explanation:"どちらもスペードのフラッシュ。共通のAの次に、A側のKがB側のQより強いのでAの勝ちです。" },
 { title:"フォーカード",board:["6♣","6♦","6♥","K♠","2♣"],a:["6♠","A♦"],b:["K♦","K♥"],winner:"A",explanation:"Aは6のフォーカード。BはKのフルハウスですが、フォーカードの方が強い役です。" }
];
// Keep explanations and correct outcomes in sync. Scenario 8: wheel straight beats trips.
questions[7].winner = "A";
function CardFace({ card }: { card: Card }) {
 const suit = card.slice(-1) as Suit;
 const rank = card.slice(0, -1);
 return <span className={styles.card} data-red={suit === "♥" || suit === "♦" ? "true" : undefined} aria-label={rank + suit}><span>{rank}<small>{suit}</small></span><b>{suit}</b></span>;
}
export function HandStrengthQuiz() {
 const [index, setIndex] = useState(0);
 const [choice, setChoice] = useState<Winner | null>(null);
 const [score, setScore] = useState(0);
 const [done, setDone] = useState(false);
 const current = questions[index];
 const answered = choice !== null;
 function select(value: Winner) { if (answered) return; setChoice(value); if (value === current.winner) setScore(s => s + 1); }
 function next() { if (index === questions.length - 1) { setDone(true); return; } setIndex(i => i + 1); setChoice(null); }
 function restart() { setIndex(0); setChoice(null); setScore(0); setDone(false); }
 return <section className={styles.quiz} aria-labelledby="hand-quiz-title">
  <header className={styles.header}><span className={styles.eyebrow}>POKER SUMMIT · INTERACTIVE CHALLENGE</span><h2 id="hand-quiz-title">カードで学ぶ、役の強さクイズ</h2><p>2人の手札と5枚の共通カードから、勝つプレイヤーを選んでみましょう。</p></header>
  <div className={styles.progress}><span>{done ? "チャレンジ完了" : `QUESTION ${index + 1} / ${questions.length}`}</span><span>{score} 問正解</span></div>
  <div className={styles.track}><div style={{ width: `${(done ? 1 : index / questions.length) * 100}%` }} /></div>
  {done ? <div className={styles.result} role="status"><span className={styles.medal}>♠</span><h3>{score} / {questions.length} 問正解！</h3><p>{score === questions.length ? "全問正解！役とキッカーの比較をしっかり理解しています。" : "カードを比較するコツがつかめてきました。解説を思い出して再挑戦しましょう。"}</p><button type="button" onClick={restart}>もう一度挑戦する ↻</button></div>
   : <><h3 className={styles.question}>{current.title}</h3><div className={styles.table}>
     <div className={styles.player}><span>PLAYER A</span><div className={styles.cards}>{current.a.map((card,i) => <CardFace key={i} card={card}/>)}</div></div>
     <div className={styles.board}><span>COMMUNITY CARDS · 共通カード</span><div className={styles.cards}>{current.board.map((card,i) => <CardFace key={i} card={card}/>)}</div></div>
     <div className={styles.player}><span>PLAYER B</span><div className={styles.cards}>{current.b.map((card,i) => <CardFace key={i} card={card}/>)}</div></div>
    </div><p className={styles.prompt}>どちらが勝つでしょうか？</p>
    <div className={styles.options}>{(["A","引き分け","B"] as Winner[]).map(value => <button key={value} type="button" disabled={answered} onClick={() => select(value)} className={answered && current.winner === value ? styles.correct : answered && choice === value ? styles.wrong : styles.option}>{value === "A" ? "PLAYER A" : value === "B" ? "PLAYER B" : "引き分け"}</button>)}</div>
    {answered && <div className={styles.feedback} role="status"><strong>{choice === current.winner ? "正解！" : "惜しい！"} 正解：{current.winner === "引き分け" ? "引き分け" : "PLAYER " + current.winner}</strong><p>{current.explanation}</p><button type="button" onClick={next}>{index === questions.length - 1 ? "結果を見る →" : "次の問題へ →"}</button></div>}
   </>}
  <p className={styles.note}>※テキサスホールデムの一般的な役判定です。各プレイヤーは手札2枚と共通カード5枚の計7枚から、最も強い5枚を使います。スート自体に強弱はありません。</p>
 </section>;
}

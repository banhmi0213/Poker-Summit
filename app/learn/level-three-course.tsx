"use client";

import { useEffect, useState } from "react";
import {
 betMetrics, LEVEL_THREE_PASS_SCORE, LEVEL_THREE_STORAGE_KEY, levelThreeExam,
 levelThreeLessons, parseLevelThreeProgress, sprMetrics,
 type LevelThreeProgress,
} from "./level-three-content";
import styles from "./level-three.module.css";
import { LessonQuiz } from "./lesson-quiz";
import { LevelThreeDiagram } from "./level-three-diagrams";

const number = (value: number) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);


function SprExercise() {
 const [own, setOwn] = useState("8000"), [opponent, setOpponent] = useState("3000"), [pot, setPot] = useState("1000");
 const values = [own, opponent, pot];
 const valid = values.every(value => value.trim() !== "" && /^\d+$/.test(value) && Number(value) <= 10000000);
 const metrics = valid ? sprMetrics(Number(own), Number(opponent), Number(pot)) : null;
 return <section className={styles.exercise} aria-label="SPR計算演習"><h4>数字を変えてSPRを比べる</h4><p>2人のポットで、同じ時点の残りスタックとポットを入力してください。</p>
  <div className={styles.fields}>{[{ id: "l3-own", label: "自分の残りスタック", value: own, set: setOwn }, { id: "l3-opponent", label: "相手の残りスタック", value: opponent, set: setOpponent }, { id: "l3-pot", label: "現在のポット", value: pot, set: setPot }].map(field => <label key={field.id} htmlFor={field.id}>{field.label}<input id={field.id} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={field.value} onChange={event => field.set(event.target.value)} /></label>)}</div>
  <div className={styles.calculation} aria-live="polite">{metrics ? <><strong>残り有効スタック {number(metrics.effective)} ／ SPR {number(metrics.spr)}</strong><p>{number(metrics.effective)} ÷ {number(Number(pot))} ＝ {number(metrics.spr)}</p></> : <p>スタックは0以上、ポットは1以上の整数を入力してください（上限1,000万）。</p>}</div>
  <p className={styles.note}>この計算は2人用です。SPRの大小だけでベットやオールインの正解は決まりません。</p>
 </section>;
}

function SizeExercise() {
 const [fraction, setFraction] = useState(0.5);
 const metrics = betMetrics(1000, fraction);
 return <section className={styles.exercise} aria-label="ベットサイズ比較"><h4>ポット1,000へのサイズを比較する</h4><p>自分のベット額を変えると、相手がコールするための必要勝率はどう変わるでしょうか。</p>
  <div className={styles.optionRow}>{[0.25, 0.5, 0.75, 1].map(value => <button type="button" key={value} aria-pressed={fraction === value} onClick={() => setFraction(value)}>{value * 100}% POT</button>)}</div>
  <div className={styles.calculation} aria-live="polite"><strong>ベット {number(metrics.bet)} ／ 相手の必要勝率 {number(metrics.requiredEquity)}%</strong><p>相手のコール額 {number(metrics.bet)} ÷ コール後のポット {number(metrics.finalPot)}</p></div>
  <p className={styles.note}>今後の追加ベット・レーキを無視した計算です。相手の実際の勝率やフォールド率、最適なサイズを求めるソルバーではありません。</p>
 </section>;
}

const boards = [
 { name: "ランクが離れたボード", cards: ["A♠", "7♦", "2♣"], explanation: "スートがばらばらでランクも離れています。Aを持つ候補やセットのほか、低いペア・バックドアの可能性などを両者の参加レンジから考えます。" },
 { name: "つながりの強いボード", cards: ["J♠", "T♠", "9♦"], explanation: "KQならストレート、同じスート2枚ならフラッシュドローができます。セットやツーペアなども候補です。相手の強い役と改善候補の両方を意識します。" },
 { name: "ペアボード", cards: ["8♥", "8♣", "3♦"], explanation: "8を持つ候補はトリップス、33はフルハウスです。参加レンジ次第で8の多さも変わります。「ペアボードだから全員弱い」とは判断しません。" },
];

function Cards({ cards }: { cards: readonly string[] }) {
 return <div className={styles.cards}>{cards.map((card, index) => <span key={`${index}-${card}`} className={/[♥♦]/.test(card) ? styles.redCard : styles.blackCard}>{card}</span>)}</div>;
}

function BoardExercise() {
 const [index, setIndex] = useState(0);
 return <section className={styles.exercise} aria-label="ボード比較"><h4>3つのフロップを見比べる</h4><div className={styles.optionRow}>{boards.map((board, i) => <button key={board.name} type="button" aria-pressed={index === i} onClick={() => setIndex(i)}>{board.name}</button>)}</div><Cards cards={boards[index].cards} /><p aria-live="polite">{boards[index].explanation}</p><p className={styles.note}>ボードの分類を練習する例です。ベット頻度や最適サイズを示す解析結果ではありません。</p></section>;
}

function RunoutExercise() {
 const [step, setStep] = useState(0), [runout, setRunout] = useState(0);
 const line = runout === 0 ? ["T♠", "9♦", "2♣", "3♥", "K♦"] : ["T♠", "9♦", "2♣", "8♣", "2♦"];
 const comments = runout === 0 ? ["8かKでストレートになるドローです。フラッシュには追加のスペード2枚が必要です。", "3♥ではストレートもフラッシュも完成していません。残りは1枚です。相手の行動とコールの条件を見直します。", "Kハイのストレートが完成しました。相手の候補とアクションを振り返り、どのハンドからバリューを取れるか検討します。"] : ["同じフロップでも、次のカードで状況が変わります。まず8かKの改善候補を確認しましょう。", "8♣でQハイのストレートが完成しました。完成したからといって相手の候補を考えなくてよいわけではありません。", "2♦でボードがペアになりました。自分はストレートですが、相手のレンジにフルハウスやフォーカードが残るかも検討します。"];
 return <section className={styles.exercise} aria-label="ストリート別カード演習"><h4>1ストリートずつ開いて考える</h4><p>自分の手札：Q♠ J♠。相手の手札は伏せたまま、公開カードの変化を確認します。</p><div className={styles.optionRow}>{["リバーで改善する例", "ターンで改善する例"].map((name, i) => <button key={name} type="button" aria-pressed={runout === i} onClick={() => { setRunout(i); setStep(0); }}>{name}</button>)}</div><strong>{["フロップ", "ターン", "リバー"][step]}</strong><Cards cards={line.slice(0, 3 + step)} /><p aria-live="polite">{comments[step]}</p><div className={styles.optionRow}><button type="button" disabled={step === 2} onClick={() => setStep(value => Math.min(2, value + 1))}>{step === 0 ? "ターンを開く" : step === 1 ? "リバーを開く" : "全カード公開済み"}</button><button type="button" onClick={() => setStep(0)}>フロップに戻す</button></div></section>;
}

function RangeExercise() {
 const [revealed, setRevealed] = useState(false);
 return <section className={styles.exercise}><h4>当てに行く前に候補を出す</h4><p>相手はプリフロップでレイズし、A♣ 7♦ 2♠でベットしました。まず、強い役・中程度の役・ブラフになり得る候補をそれぞれ考えてください。</p><button type="button" aria-expanded={revealed} onClick={() => setRevealed(value => !value)}>{revealed ? "候補の例を閉じる" : "候補の例を確認する"}</button>{revealed && <div className={styles.feedback}><p>候補の例：AA・77・22のセット、AK・AQなどのトップペア、KK・QQなどのペア、KQなどのノーペア。</p><p>どれが実際に参加・ベットするか、その割合は席順や戦略によって変わります。これは網羅的なレンジやGTOチャートではありません。</p></div>}</section>;
}

function ReviewExercise() {
 const [checks, setChecks] = useState<boolean[]>([false, false, false, false]);
 const labels = ["人数・ポジション・残りスタック・ベット額を記録した", "判断時に見えていた情報と、後で判明した情報を分けた", "選んだ理由と、別の選択肢を1つ挙げた", "次回実行する練習目標を1つ決めた"];
 return <section className={styles.exercise}><h4>レビューの準備チェック</h4><p>最近のハンド、またはこのコースの例題を思い出して確認してください。このチェック内容は保存されません。</p><div className={styles.checklist}>{labels.map((label, i) => <label key={label}><input type="checkbox" checked={checks[i]} onChange={event => setChecks(previous => previous.map((value, index) => index === i ? event.target.checked : value))} />{label}</label>)}</div><p role="status">{checks.filter(Boolean).length} / 4 項目を確認{checks.every(Boolean) ? "。判断を再現して振り返る準備ができました。" : "。記録できない項目は、不明点として残しましょう。"}</p></section>;
}

export function LevelThreeCourse() {
 const [selected, setSelected] = useState("ranges");
 const [progress, setProgress] = useState<LevelThreeProgress>({ completed: [], bestScore: null });
 const [loaded, setLoaded] = useState(false), [storageAvailable, setStorageAvailable] = useState(true);
 const [practiceDone, setPracticeDone] = useState(false);
 useEffect(() => {
  try { setProgress(parseLevelThreeProgress(localStorage.getItem(LEVEL_THREE_STORAGE_KEY))); }
  catch { setStorageAvailable(false); }
  setLoaded(true);
 }, []);
 function persist(next: LevelThreeProgress) {
  setProgress(next);
  try { localStorage.setItem(LEVEL_THREE_STORAGE_KEY, JSON.stringify(next)); }
  catch { setStorageAvailable(false); }
 }
 function goTo(id: string) {
  setSelected(id); setPracticeDone(false);
  requestAnimationFrame(() => { const heading = document.getElementById("level-three-current-title"); heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ behavior: "auto", block: "start" }); });
 }
 const lesson = levelThreeLessons.find(item => item.id === selected);
 const index = levelThreeLessons.findIndex(item => item.id === selected);
 const complete = lesson ? progress.completed.includes(lesson.id) : false;
 return <section id="level-three-course" className={styles.course} aria-labelledby="level-three-title">
  <header className={styles.header}><span>LEVEL 3 · PRACTICAL CHALLENGER</span><h2 id="level-three-title">実戦チャレンジャー</h2><p>6レッスンで判断の根拠を学び、12問の実戦判断テストに挑戦。初めての方は初心者コースを先に学ぶと進めやすくなります。</p><p className={styles.note}>主に一般的なノーリミット・テキサスホールデムを想定します。例題は条件を絞った教材であり、GTOソルバーの解析結果ではありません。</p></header>
  <div className={styles.progress} aria-label="Lv.3学習進捗"><div><strong>{loaded ? `${progress.completed.length} / 6 レッスン学習済み` : "学習状況を読み込み中"}</strong><p>テスト最高得点：{loaded && progress.bestScore !== null ? `${progress.bestScore} / 12` : "未記録"}{loaded && progress.bestScore !== null && progress.bestScore >= LEVEL_THREE_PASS_SCORE ? "（合格）" : ""}</p></div><progress max={6} value={progress.completed.length} aria-label="Lv.3の学習済みレッスン数" /></div>
  <p className={styles.note} role="status">{storageAvailable ? "学習済みとテスト最高得点はこのブラウザに保存します。会員レベル・バッジは変更されません。" : "ブラウザへの保存が利用できません。この画面では学習できますが、再読み込み後に記録が残らない場合があります。"}</p>
  <div className={styles.layout}>
   <nav className={styles.navigation} aria-label="Lv.3のレッスンを選ぶ">{levelThreeLessons.map((item, i) => <button type="button" key={item.id} aria-current={selected === item.id ? "step" : undefined} onClick={() => goTo(item.id)}><span>{String(i + 1).padStart(2, "0")}</span><strong>{item.title}</strong>{progress.completed.includes(item.id) && <small>学習済み</small>}</button>)}<button type="button" aria-current={selected === "exam" ? "step" : undefined} onClick={() => goTo("exam")}><span>07</span><strong>実戦判断テスト</strong></button></nav>
   <div className={styles.main}>
    <h3 id="level-three-current-title" tabIndex={-1}>{lesson ? `${String(index + 1).padStart(2, "0")} ${lesson.title}` : "07 実戦判断テスト"}</h3>
    {lesson ? <>
     <p className={styles.subtitle}>{lesson.subtitle}</p><p className={styles.goal}><strong>このレッスンの目標</strong>{lesson.goal}</p>
     <LevelThreeDiagram lessonId={lesson.id} />{lesson.sections.map(item => <section key={item.title} className={styles.explanation}><h4>{item.title}</h4><p>{item.text}</p></section>)}
     <p className={styles.takeaway}><strong>覚えておきたいこと</strong>{lesson.takeaway}</p>
     {lesson.id === "ranges" && <RangeExercise />}{lesson.id === "spr" && <SprExercise />}{lesson.id === "betting" && <SizeExercise />}{lesson.id === "flop" && <BoardExercise />}{lesson.id === "streets" && <RunoutExercise />}{lesson.id === "review" && <ReviewExercise />}
     <LessonQuiz key={lesson.id} questions={lesson.questions} onFinish={() => setPracticeDone(true)} />
     <div className={styles.footer}><button type="button" disabled={!loaded || (!complete && !practiceDone)} aria-pressed={complete} onClick={() => { if (!loaded || (!complete && !practiceDone)) return; persist({ ...progress, completed: complete ? progress.completed.filter(id => id !== lesson.id) : [...progress.completed, lesson.id] }); }}>{complete ? "学習済みを解除する" : "解説を確認して学習済みにする"}</button><button type="button" onClick={() => goTo(index < levelThreeLessons.length - 1 ? levelThreeLessons[index + 1].id : "exam")}>{index < levelThreeLessons.length - 1 ? "次のレッスンへ" : "実戦判断テストへ"}</button></div>
     {!complete && !practiceDone && <p className={styles.note}>2問に回答し、解説の後で「結果を見る」を押すと、学習済みにできます。</p>}
    </> : <>
     <p>全6レッスンから12問。{LEVEL_THREE_PASS_SCORE}問以上の正解で合格です。レッスンの学習済みチェックとは別に採点し、何度でも受け直せます。</p>
     {loaded ? <LessonQuiz key="level3-exam" questions={levelThreeExam} exam onFinish={score => persist({ ...progress, bestScore: Math.max(progress.bestScore ?? 0, score) })} /> : <p>学習記録を読み込んでいます。</p>}
    </>}
   </div>
  </div>
  <details className={styles.sources}><summary>学習内容の参考資料</summary><p>本コースの文章・例題はPoker Summit独自の教材です。用語や考え方の確認には、以下の資料も参考にできます（英語）。</p><ul><li><a href="https://blog.gtowizard.com/stack-to-pot-ratio/" target="_blank" rel="noopener noreferrer">GTO Wizard：Stack-to-pot ratio</a></li><li><a href="https://help.gtowizard.com/ranges-tab/" target="_blank" rel="noopener noreferrer">GTO Wizard：Ranges Tab</a></li><li><a href="https://help.gtowizard.com/tips-and-tricks-to-study-analyzed-hands/" target="_blank" rel="noopener noreferrer">GTO Wizard：Tips &amp; Tricks to Study Analyzed Hands</a></li></ul></details>
 </section>;
}

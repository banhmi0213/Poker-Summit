"use client";

import { useState } from "react";
import styles from "./pot-odds-trainer.module.css";
import { toQuizTop } from "@/lib/ui/quiz-top";

type Scenario = { pot: number; bet: number; outs: number; streets: 1 | 2; label: string; note: string };
const challenges: Scenario[] = [
 { pot: 1000, bet: 500, outs: 9, streets: 1, label: "フラッシュドロー・リバーまで1枚", note: "フロップではなくターンの場面。フラッシュ完成の9アウトを想定します。" },
 { pot: 1200, bet: 300, outs: 8, streets: 1, label: "オープンエンドストレートドロー", note: "ターンからリバーへ。8アウトのストレートドローです。" },
 { pot: 800, bet: 800, outs: 4, streets: 1, label: "ガットショット・大きなベット", note: "ターンからリバーへ。4アウトのインサイドストレートドローです。" },
 { pot: 600, bet: 200, outs: 9, streets: 1, label: "小さいベットへのフラッシュドロー", note: "ターンからリバーへ。9アウトを想定します。" },
 { pot: 1500, bet: 1000, outs: 8, streets: 1, label: "大きなベットへのストレートドロー", note: "ターンからリバーへ。8アウトを想定します。" }
];
function fmt(n: number) { return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(n); }
function pct(n: number) { return n.toFixed(1) + "%"; }
function chance(outs: number, streets: number) {
 // Probability of hitting at least one of the outs in 1 or 2 unseen community cards.
 const oneMiss = (47 - outs) / 47;
 return streets === 1 ? (1 - oneMiss) * 100 : (1 - oneMiss * (46 - outs) / 46) * 100;
}
function metrics(pot: number, bet: number, outs: number, streets: number) {
 const call = bet;
 const finalPot = pot + bet + call;
 const required = finalPot > 0 ? call / finalPot * 100 : 0;
 const equity = chance(outs, streets);
 return { call, finalPot, required, equity, difference: equity - required, ev: equity / 100 * (pot + bet) - (1 - equity / 100) * call };
}
function NumberField({label,value,onChange,min=0,max=1000000,step=50}: {label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;step?:number}) {
 const clamp = (n:number) => Math.min(max,Math.max(min,Math.round(n)));
 return <div className={styles.field}><label htmlFor={label}>{label}</label><div className={styles.numberControl}>
  <button type="button" className={styles.stepButton} aria-label={label+"を減らす"} disabled={value<=min} onClick={()=>onChange(clamp(value-step))}>−</button>
  <input id={label} type="number" inputMode="numeric" min={min} max={max} step={step} value={value} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(clamp(n));}}/>
  <button type="button" className={styles.stepButton} aria-label={label+"を増やす"} disabled={value>=max} onClick={()=>onChange(clamp(value+step))}>＋</button>
 </div></div>;
}
export function PotOddsTrainer() {
 const [pot,setPot] = useState(1000);
 const [bet,setBet] = useState(500);
 const [outs,setOuts] = useState(9);
 const [streets,setStreets] = useState<1|2>(1);
 const [quizIndex,setQuizIndex] = useState(0);
 const [answer,setAnswer] = useState<"call"|"fold"|null>(null);
 const [score,setScore] = useState(0);
 const [finished,setFinished] = useState(false);
 const m = metrics(pot,bet,outs,streets);
 const current = challenges[quizIndex];
 const qm = metrics(current.pot,current.bet,current.outs,current.streets);
 const correct = qm.equity >= qm.required ? "call" : "fold";
 function choose(choice:"call"|"fold"){if(answer!==null)return;setAnswer(choice);if(choice===correct)setScore(s=>s+1);}
 function next(){if(quizIndex===challenges.length-1){setFinished(true);return;}setQuizIndex(i=>i+1);setAnswer(null);}
 function restart(){setQuizIndex(0);setAnswer(null);setScore(0);setFinished(false);}
 return <section className={styles.trainer} aria-labelledby="pot-odds-title">
  <header className={styles.heading}><span className={styles.eyebrow}>POKER SUMMIT · INTERACTIVE LESSON</span><h2 id="pot-odds-title">ポットオッズ計算トレーナー</h2><p>数字を変えるだけで、コールに必要な勝率とドローの完成確率を比較できます。</p></header>
  <div className={styles.lesson}>
   <div className={styles.controls}>
    <div className={styles.panelHead}><span>01 · CALCULATOR</span><h3>数字を入れて計算</h3></div>
    <div className={styles.fields}><NumberField label="相手のベット前のポット（チップ）" value={pot} onChange={setPot}/><NumberField label="相手のベット額（チップ）" value={bet} onChange={setBet}/><NumberField label="有効なアウト数（枚）" value={outs} onChange={setOuts} min={0} max={20} step={1}/></div>
    <div className={styles.streets}><span>残りのカード</span><div><button type="button" aria-pressed={streets===1} className={streets===1?styles.pressed:styles.unpressed} onClick={()=>setStreets(1)}>1枚（ターン→リバー）</button><button type="button" aria-pressed={streets===2} className={streets===2?styles.pressed:styles.unpressed} onClick={()=>setStreets(2)}>2枚（フロップ→リバー）</button></div></div>
    <p className={styles.hint}>例：ポット1,000に相手が500ベット → コール額は500。相手のベット前のポットを入力してください。</p>
    <button type="button" className={styles.reset} onClick={()=>{setPot(1000);setBet(500);setOuts(9);setStreets(1);}}>↻ 初期値に戻す</button>
   </div>
   <div className={styles.results} aria-live="polite">
    <div className={styles.panelHead}><span>02 · YOUR ODDS</span><h3>計算結果</h3></div>
    <div className={styles.metrics}><div><span>コールに必要な勝率</span><strong>{pct(m.required)}</strong></div><div><span>ドロー完成確率</span><strong>{pct(m.equity)}</strong></div></div>
    <div className={styles.bars}><div className={styles.barLabel}><span>必要勝率</span><b>{pct(m.required)}</b></div><div className={styles.track}><span className={styles.requiredBar} style={{width:Math.min(100,m.required)+"%"}}/></div><div className={styles.barLabel}><span>完成確率</span><b>{pct(m.equity)}</b></div><div className={styles.track}><span className={styles.equityBar} style={{width:Math.min(100,m.equity)+"%"}}/></div></div>
    <div className={m.difference>=0?styles.positive:styles.negative}><strong>{m.difference>=0?"この条件なら、コールが計算上有利":"この条件なら、フォールドが計算上有利"}</strong><p>完成確率 − 必要勝率 = {m.difference>=0?"+":""}{pct(m.difference)}</p></div>
    <div className={styles.formula}><strong>計算の仕組み</strong><p>必要勝率 ＝ コール額 ÷（元のポット ＋ 相手のベット ＋ コール額）</p><p>{fmt(m.call)} ÷（{fmt(pot)} ＋ {fmt(bet)} ＋ {fmt(m.call)}）＝ {pct(m.required)}</p><p>コール後のポット：{fmt(m.finalPot)} チップ</p><p>単純化した期待値（EV）：{m.ev>=0?"+":""}{fmt(m.ev)} チップ</p></div>
   </div>
  </div>
  <div className={styles.quiz}>
   <div className={styles.quizHead}><div><span className={styles.eyebrow}>QUICK CHALLENGE</span><h3>5問でポットオッズ判断に挑戦</h3></div><span>{finished?"結果":`${quizIndex+1} / ${challenges.length}`}</span></div>
   {finished?<div className={styles.finished} role="status"><strong>{score} / {challenges.length} 問正解！</strong><p>{score===challenges.length?"全問正解です！必要勝率と完成確率の比較ができています。":"計算結果と解説を確認して、もう一度挑戦しましょう。"}</p><button type="button" onClick={restart}>もう一度挑戦する ↻</button></div>:<>
    <p className={styles.scenario}>{current.label}</p><div className={styles.chips}><span>ポット <b>{fmt(current.pot)}</b></span><span>相手のベット <b>{fmt(current.bet)}</b></span><span>アウト <b>{current.outs}枚</b></span></div>
    <p className={styles.scenarioNote}>{current.note}</p><p className={styles.question}>追加のベットや将来のアクションを無視した場合、コールとフォールドのどちらが計算上有利？</p>
    <div className={styles.answers}><button type="button" disabled={answer!==null} onClick={()=>choose("call")}>コール</button><button type="button" disabled={answer!==null} onClick={()=>choose("fold")}>フォールド</button></div>
    {answer!==null&&<div className={styles.feedback} role="status"><strong>{answer===correct?"正解！":"惜しい！"} この条件では{correct==="call"?"コール":"フォールド"}が計算上有利です。</strong><p>必要勝率は {pct(qm.required)}、完成確率は {pct(qm.equity)}。{qm.equity>=qm.required?"完成確率が必要勝率を上回っています。":"完成確率が必要勝率を下回っています。"}</p><button type="button" onClick={e=>{next();toQuizTop(e.currentTarget);}}>{quizIndex===challenges.length-1?"結果を見る":"次の問題へ"}</button></div>}
   </>}
  </div>
  <p className={styles.disclaimer}>※アウトがすべて勝ちにつながり、完成しなければ負けるという簡略化したドローの教材です。相手のハンド・リバースインプライドオッズ・将来のベット・レーキなどは考慮しません。2枚の完成確率は最後まで追加コストなしでカードを見られる場合の理論値であり、通常のフロップでの単発コール判断にそのまま使えません。実戦ではハンドエクイティや相手のレンジも考慮してください。</p>
 </section>;
}

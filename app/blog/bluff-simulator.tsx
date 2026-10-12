"use client";
import { useState } from "react";
import styles from "./bluff-simulator.module.css";
function ChipAmount({id,label,value,onChange}:{id:string;label:string;value:number;onChange:(n:number)=>void}) {
 const update=(n:number)=>onChange(Math.min(10000000,Math.max(0,Math.round(n))));
 return <div className={styles.amountField}><label htmlFor={id}>{label}</label><div className={styles.amountControl}>
 <button type="button" aria-label={label+"を減らす"} disabled={value<=0} onClick={()=>update(value-100)}>−</button>
 <input id={id} type="number" inputMode="numeric" min="0" max="10000000" step="100" value={value} onChange={e=>{if(e.target.value!=="")update(Number(e.target.value));}} />
 <button type="button" aria-label={label+"を増やす"} disabled={value>=10000000} onClick={()=>update(value+100)}>＋</button>
 </div></div>;
}
const questions=[
["相手は弱いペアでもよくコールします。ブラフを仕掛ける？","無理にブラフしない","大きくベットする",0,"コールしやすい相手にはブラフが成功しにくくなります。"],
["フロップでフラッシュドローを持っています。セミブラフの利点は？","完成すれば必ず勝てる","フォールドを狙い、コールされても改善の可能性がある",1,"セミブラフはフォールドとハンド改善の両方が勝ち筋です。"],
["複数人が参加するポットで注意すべきことは？","誰かがコールする可能性が高まる","人数が多いほどブラフは必ず成功する",0,"参加人数が多いほど誰かが続行する可能性があります。"],
["リバーにフラッシュが完成し得るカード。判断の基本は？","必ずブラフする","相手のレンジと自分のアクションを確認する",1,"怖いカードが出ただけでは十分ではありません。"],
["フロップのブラフがコールされました。ターンでは？","状況を再評価する","必ず続けてベットする",0,"相手のコールと新しいカードを踏まえて判断しましょう。"]
] as const;
export function BluffSimulator(){
 const [pot,setPot]=useState(1000),[bet,setBet]=useState(500),[fold,setFold]=useState(40);
 const [index,setIndex]=useState(0),[answer,setAnswer]=useState<number|null>(null),[score,setScore]=useState(0);
 const need=pot+bet>0?100*bet/(pot+bet):0,ev=fold/100*pot-(1-fold/100)*bet;
 const q=questions[index];
 function pick(n:number){if(answer!==null)return;setAnswer(n);if(n===q[3])setScore(v=>v+1);}
 return <section className={styles.tool} aria-labelledby="bluff-tool-title">
 <header><small>POKER SUMMIT · INTERACTIVE TOOL</small><h2 id="bluff-tool-title">ブラフ判断シミュレーター</h2><p>数字を動かして必要フォールド率を学び、5つの場面で判断してみましょう。</p></header>
 <div className={styles.grid}><div className={styles.panel}><h3>① 必要フォールド率を計算</h3>
 <ChipAmount id="bluff-pot" label="ベット前のポット（チップ）" value={pot} onChange={setPot}/>
 <ChipAmount id="bluff-bet" label="自分のベット額（チップ）" value={bet} onChange={setBet}/>
 <label>相手の予想フォールド率：{fold}%<input type="range" min="0" max="100" value={fold} onChange={e=>setFold(Number(e.target.value))}/></label>
 <button type="button" onClick={()=>{setPot(1000);setBet(500);setFold(40);}}>↻ 初期値に戻す</button></div>
 <div className={styles.panel} aria-live="polite"><h3>② 計算結果</h3><div className={styles.metric}>{need.toFixed(1)}<span>%</span></div><p>必要フォールド率 ＝ ベット額 ÷（ベット前のポット ＋ ベット額）× 100</p><p>予想フォールド率：<strong>{fold}%</strong></p><p className={styles.result}>{ev>0?"仮定上は期待値がプラス":ev<0?"仮定上は期待値がマイナス":"仮定上は期待値がゼロ"}（{Math.round(ev).toLocaleString("ja-JP")} チップ）</p></div></div>
 <div className={styles.panel}><h3>③ 5問のブラフ判断クイズ</h3><p>{index+1} / {questions.length}：{q[0]}</p><div className={styles.choices}>{[q[1],q[2]].map((label,n)=><button type="button" key={n} disabled={answer!==null} onClick={()=>pick(n)}>{label}</button>)}</div>
 {answer!==null&&<div role="status" className={styles.feedback}><strong>{answer===q[3]?"正解！":"惜しい！"}</strong><p>{q[4]}</p><button type="button" onClick={()=>{if(index===questions.length-1){setIndex(0);setScore(0);}else setIndex(v=>v+1);setAnswer(null);}}>{index===questions.length-1?"結果："+score+" / 5 正解・もう一度挑戦":"次の問題へ →"}</button></div>}</div>
 <p className={styles.note}>※計算は相手1人、コールされたら必ず負けるピュアブラフ、追加アクションやレーキなしを想定。フォールド率は練習用の仮定で、実戦の正確な確率ではありません。クイズは一般的な初心者向け判断例です。</p></section>;
}
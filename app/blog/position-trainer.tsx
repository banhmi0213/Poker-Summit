"use client";

import { useState } from "react";
import styles from "./position-trainer.module.css";

type Seat = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB";
const seats: { id: Seat; name: string; zone: string; x: number; y: number; info: string; tip: string }[] = [
 { id:"UTG",name:"アンダー・ザ・ガン",zone:"アーリー",x:170,y:38,info:"プリフロップで最初にアクションする席です。後ろに5人が残っているため、参加ハンドを厳選することが基本です。",tip:"強いハンドを中心に参加し、後続のレイズに備えましょう。" },
 { id:"HJ",name:"ハイジャック",zone:"ミドル",x:291,y:79,info:"UTGの次にアクションする席です。UTGより後続人数が少ないものの、COとBTNが残っています。",tip:"UTGより少し広い範囲を検討できますが、後ろの強いアクションに注意。" },
 { id:"CO",name:"カットオフ",zone:"レイト",x:291,y:174,info:"BTNの1つ手前。後ろはBTN・SB・BBの3人で、比較的積極的に参加しやすい席です。",tip:"ブラインドを獲得するチャンスがありますが、BTNの反応も考えましょう。" },
 { id:"BTN",name:"ボタン",zone:"レイト",x:170,y:214,info:"プリフロップではCOの次、SB・BBより前にアクションします。フロップ以降は通常、最後に行動できる有利な席です。",tip:"相手の行動を見て判断できるため、ほかの席より広いハンドを検討しやすくなります。" },
 { id:"SB",name:"スモールブラインド",zone:"ブラインド",x:49,y:174,info:"小さい強制ベットを出す席。プリフロップではBTNの後、BBの前に行動します。フロップ以降は通常、最初に行動します。",tip:"ポストフロップの位置が不利なので、安易な参加に注意しましょう。" },
 { id:"BB",name:"ビッグブラインド",zone:"ブラインド",x:49,y:79,info:"大きい強制ベットを出す席。プリフロップでは原則として最後にアクションします。",tip:"すでに出したブラインドと相手のレイズ額を踏まえて判断しましょう。" }
];
const questions: {question:string; options:Seat[]; answer:Seat; explain:string}[] = [
 {question:"プリフロップで最初に行動する席は？",options:["UTG","HJ","BTN","BB"],answer:"UTG",explain:"6人テーブルでは、プリフロップはBBの左隣のUTGから始まります。"},
 {question:"フロップ以降、通常最後に行動できる席は？",options:["SB","CO","BTN","UTG"],answer:"BTN",explain:"BTNはポストフロップで相手のアクションを確認してから判断できます。"},
 {question:"プリフロップで大きい強制ベットを出す席は？",options:["HJ","SB","BB","CO"],answer:"BB",explain:"BBはビッグブラインドを支払います。SBは小さいブラインドを支払います。"}
];

export function PositionTrainer(){
 const [active,setActive]=useState<Seat>("BTN");
 const [index,setIndex]=useState(0);
 const [answer,setAnswer]=useState<Seat|null>(null);
 const [score,setScore]=useState(0);
 const [complete,setComplete]=useState(false);
 const selected=seats.find(s=>s.id===active)!;
 const question=questions[index];
 function choose(id:Seat){if(answer!==null)return;setAnswer(id);if(id===question.answer)setScore(s=>s+1);}
 function next(){if(index===questions.length-1){setComplete(true);return;}setIndex(i=>i+1);setAnswer(null);}
 function reset(){setIndex(0);setAnswer(null);setScore(0);setComplete(false);}
 return <section className={styles.trainer} aria-labelledby="position-trainer-title">
  <div className={styles.heading}><span className={styles.eyebrow}>POKER SUMMIT · INTERACTIVE LESSON</span><h2 id="position-trainer-title">触って覚える、ポーカーのポジション</h2><p>6人テーブルの席を選んで、行動順と特徴を学びましょう。</p></div>
  <div className={styles.lesson}>
   <div className={styles.board}>
    <svg viewBox="0 0 340 250" role="img" aria-label="6人用ポーカーテーブル。周囲のボタンで席を選択できます">
     <ellipse cx="170" cy="125" rx="126" ry="78" fill="#8a5d2c" stroke="#e8bc70" strokeWidth="5"/>
     <ellipse cx="170" cy="125" rx="115" ry="67" fill="#0b6047" stroke="#348e72" strokeWidth="2"/>
     <ellipse cx="170" cy="125" rx="80" ry="42" fill="none" stroke="#d6b77d" strokeDasharray="3 5" opacity=".6"/>
     <text x="170" y="120" textAnchor="middle" fill="#e9d7b2" fontSize="13" fontWeight="bold">POKER SUMMIT</text>
     <text x="170" y="140" textAnchor="middle" fill="#c7b38c" fontSize="10">6-MAX POSITION</text>
     {seats.map(s=><g key={s.id}><circle cx={s.x} cy={s.y} r="24" fill={active===s.id?"#e9bf65":"#203b35"} stroke={active===s.id?"#fff3c7":"#bba780"} strokeWidth={active===s.id?3:1.5}/><text x={s.x} y={s.y+5} textAnchor="middle" fill={active===s.id?"#2c1d09":"white"} fontSize="13" fontWeight="bold">{s.id}</text></g>)}
    </svg>
    <div className={styles.seats} aria-label="ポジションを選択">{seats.map(s=><button key={s.id} type="button" aria-pressed={active===s.id} className={active===s.id?styles.seatActive:styles.seat} onClick={()=>setActive(s.id)}>{s.id}</button>)}</div>
   </div>
   <div className={styles.detail} aria-live="polite"><span className={styles.zone}>{selected.zone}ポジション</span><h3>{selected.id} <small>{selected.name}</small></h3><p>{selected.info}</p><div className={styles.tip}><strong>覚えておきたいポイント</strong><p>{selected.tip}</p></div><div className={styles.order}><strong>プリフロップの行動順</strong><div>UTG → HJ → CO → BTN → SB → BB</div><small>※レイズなどがあればアクションは再び回ります。</small></div></div>
  </div>
  <div className={styles.quiz}><div className={styles.quizHead}><div><span className={styles.eyebrow}>QUICK CHALLENGE</span><h3>3問で理解度チェック</h3></div><span className={styles.progress}>{complete?"結果":`${index+1} / ${questions.length}`}</span></div>
   {complete?<div className={styles.result} role="status"><strong>{score} / {questions.length} 問正解！</strong><p>{score===questions.length?"全問正解です！ポジションの基本を理解できています。":"席の説明をもう一度確認して、再チャレンジしてみましょう。"}</p><button type="button" onClick={reset}>もう一度挑戦する ↻</button></div>:<><p className={styles.question}>{question.question}</p><div className={styles.answers}>{question.options.map(id=><button type="button" key={id} disabled={answer!==null} onClick={()=>choose(id)} className={answer!==null&&id===question.answer?styles.correct:answer===id?styles.incorrect:styles.option}>{id}</button>)}</div>{answer!==null&&<div className={styles.feedback} role="status"><strong>{answer===question.answer?"正解！":"惜しい！正解は "+question.answer+" です。"}</strong><p>{question.explain}</p><button type="button" onClick={next}>{index===questions.length-1?"結果を見る":"次の問題へ"}</button></div>}</>}
  </div>
  <p className={styles.note}>※一般的な6人制テキサスホールデムを想定した初心者向け教材です。戦略はスタック・参加人数・相手の行動によって変わります。</p>
 </section>;
}

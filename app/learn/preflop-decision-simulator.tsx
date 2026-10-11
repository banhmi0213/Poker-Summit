"use client";

import { useState } from "react";
import styles from "./preflop-decision-simulator.module.css";

type Action = "fold" | "call" | "raise";
type Seat = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB";
type Suit = "♠" | "♥" | "♦" | "♣";
type Case = { seat:Seat; cards:[string,string]; suits:[Suit,Suit]; situation:string; stack:string; pot:string; options:Action[]; best:Action; reason:string; tip:string };
const cases:Case[] = [
 {seat:"UTG",cards:["A","K"],suits:["♠","♠"],situation:"自分まで全員フォールド",stack:"100 BB",pot:"1.5 BB",options:["fold","call","raise"],best:"raise",reason:"AKsはUTGからでも強いスターティングハンド。先に参加するならレイズで主導権を取るのが基本です。",tip:"早いポジションでは参加レンジを絞りましょう。"},
 {seat:"UTG",cards:["9","7"],suits:["♥","♥"],situation:"自分まで全員フォールド",stack:"100 BB",pot:"1.5 BB",options:["fold","call","raise"],best:"fold",reason:"97sはUTGでは通常参加するには弱め。後ろに5人いるため、強いレンジを意識してフォールドします。",tip:"同じハンドでも席が変わると判断が変わります。"},
 {seat:"BTN",cards:["K","9"],suits:["♣","♣"],situation:"自分まで全員フォールド",stack:"100 BB",pot:"1.5 BB",options:["fold","call","raise"],best:"raise",reason:"BTNはポストフロップで有利なポジション。K9sは一般的なオープンレイズ候補です。",tip:"後ろにSBとBBしかいないため参加レンジを広げられます。"},
 {seat:"CO",cards:["A","5"],suits:["♦","♦"],situation:"自分まで全員フォールド",stack:"100 BB",pot:"1.5 BB",options:["fold","call","raise"],best:"raise",reason:"A5sはCOからの標準的なオープンレイズ候補。ナッツフラッシュの可能性やストレートの可能性があります。",tip:"スーテッドAはスーテッドでない弱いAと区別して考えましょう。"},
 {seat:"HJ",cards:["8","3"],suits:["♠","♦"],situation:"自分まで全員フォールド",stack:"100 BB",pot:"1.5 BB",options:["fold","call","raise"],best:"fold",reason:"83oは弱く、HJからのオープンには適しません。ハンドを選ぶことが基本です。",tip:"参加しない判断も大切な技術です。"},
 {seat:"BTN",cards:["Q","J"],suits:["♥","♥"],situation:"UTGが2.5 BBにレイズ。HJ・COはフォールド",stack:"100 BB",pot:"4 BB",options:["fold","call","raise"],best:"call",reason:"QJsはプレーしやすいスーテッドブロードウェイ。UTGの強いレンジに対してBTNからコールを検討できます。3ベットも戦略次第で候補です。",tip:"相手が先にレイズしたときは、オープンレイズとは別のレンジで判断します。"},
 {seat:"BTN",cards:["7","2"],suits:["♣","♦"],situation:"COが2.5 BBにレイズ",stack:"100 BB",pot:"4 BB",options:["fold","call","raise"],best:"fold",reason:"72oは非常に弱いハンド。ポジションが良くてもCOのレイズに対してはフォールドが基本です。",tip:"BTNだからといってすべてのハンドで参加するわけではありません。"},
 {seat:"BB",cards:["A","Q"],suits:["♠","♦"],situation:"BTNが2.5 BBにレイズ。SBはフォールド",stack:"100 BB",pot:"4 BB",options:["fold","call","raise"],best:"raise",reason:"AQoはBTNの広いオープンレンジに対して強いハンド。BBからの3ベットが有力な基本戦略です。コールを混ぜる戦略もあります。",tip:"相手のポジションによって同じAQoの価値が変わります。"},
 {seat:"SB",cards:["J","4"],suits:["♥","♣"],situation:"自分まで全員フォールド",stack:"100 BB",pot:"1.5 BB",options:["fold","call","raise"],best:"fold",reason:"J4oはSBから無理に参加する必要がないハンド。ポストフロップではBBに対して先に行動するため不利です。",tip:"SBはすでに0.5 BBを出していますが、投入済みチップに引きずられないことが重要です。"},
 {seat:"CO",cards:["T","T"],suits:["♠","♥"],situation:"自分まで全員フォールド",stack:"100 BB",pot:"1.5 BB",options:["fold","call","raise"],best:"raise",reason:"TTは強いポケットペア。COで未参加ならレイズが基本です。",tip:"強いハンドでは先にレイズして主導権を取りましょう。"}
];
const actionLabel:Record<Action,string>={fold:"フォールド",call:"コール",raise:"レイズ"};
const seats:Seat[]=["UTG","HJ","CO","BTN","SB","BB"];
export function PreflopDecisionSimulator(){
 const [index,setIndex]=useState(0);
 const [choice,setChoice]=useState<Action|null>(null);
 const [score,setScore]=useState(0);
 const [done,setDone]=useState(false);
 const item=cases[index];
 const correct=choice===item.best;
 function answer(action:Action){if(choice!==null)return;setChoice(action);if(action===item.best)setScore(v=>v+1);}
 function next(){if(index===cases.length-1){setDone(true);return;}setIndex(v=>v+1);setChoice(null);}
 function reset(){setIndex(0);setChoice(null);setScore(0);setDone(false);}
 return <section className={styles.root} aria-labelledby="simulator-title">
 <header className={styles.header}><span className={styles.eyebrow}>POKER SUMMIT · DECISION LAB</span><h2 id="simulator-title">プリフロップ判断シミュレーター</h2><p>ポジション・手札・相手のアクションを見て、あなたならどうするか選んでみましょう。</p></header>
 <div className={styles.topline}><span>{done?"RESULT":`SCENARIO ${index+1} / ${cases.length}`}</span><strong>{score} 問正解</strong></div><div className={styles.progress}><span style={{width:`${(done?cases.length:index+1)/cases.length*100}%`}}/></div>
 {done?<div className={styles.finish} role="status"><span className={styles.eyebrow}>SESSION COMPLETE</span><h3>{score} / {cases.length} 問正解！</h3><p>{score===cases.length?"全問正解です！ ポジションと相手のアクションをよく見て判断できています。":"解説を確認しながら、もう一度判断の練習をしてみましょう。"}</p><button type="button" onClick={reset}>もう一度挑戦する ↻</button></div>:<>
 <div className={styles.layout}><div className={styles.tablePanel}>
  <div className={styles.table} aria-label="6人テーブルのポジション配置"><div className={styles.felt}><span>POKER SUMMIT</span><small>6-MAX · PREFLOP</small></div>{seats.map((seat,i)=><div key={seat} className={`${styles.seat} ${styles["seat"+i]} ${seat===item.seat?styles.heroSeat:""}`}>{seat}</div>)}</div>
  <div className={styles.cards}><span>YOUR HAND</span><div>{item.cards.map((rank,i)=><div key={i} className={item.suits[i]==="♥"||item.suits[i]==="♦"?styles.redCard:styles.blackCard}><strong>{rank}</strong><span>{item.suits[i]}</span></div>)}</div></div>
 </div><div className={styles.details}><span className={styles.eyebrow}>YOUR TURN TO ACT</span><h3>{item.seat}からの判断</h3><div className={styles.detailRow}><span>ポジション</span><strong>{item.seat}</strong></div><div className={styles.detailRow}><span>有効スタック</span><strong>{item.stack}</strong></div><div className={styles.detailRow}><span>現在のポット</span><strong>{item.pot}</strong></div><div className={styles.situation}><strong>あなたまでのアクション</strong><p>{item.situation}</p></div><p className={styles.tip}>{item.tip}</p></div></div>
 <div className={styles.question}><h3>あなたならどうする？</h3><div className={styles.actions}>{item.options.map(action=><button key={action} type="button" disabled={choice!==null} className={choice===action?styles.selected:undefined} onClick={()=>answer(action)}>{actionLabel[action]}</button>)}</div>
 {choice!==null&&<div className={styles.feedback} role="status"><strong>{correct?"✓ 正解です！":"もう一歩！"} 基本の推奨アクション：{actionLabel[item.best]}</strong><p>{item.reason}</p><button type="button" onClick={next}>{index===cases.length-1?"結果を見る →":"次のシナリオへ →"}</button></div>}</div></>}
 <p className={styles.disclaimer}>※6-max・100BB前後・一般的なキャッシュゲームを想定した初心者向けの単純化した例題です。推奨アクションは唯一の正解ではありません。レーキ、オープンサイズ、相手の傾向、トーナメントのICM等で最適戦略は変わります。コールと3ベットの両方が妥当な場面もあります。</p>
 </section>;
}

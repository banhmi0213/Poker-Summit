"use client";
import {useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import styles from "./graduation-test.module.css";
type Q={topic:string;question:string;choices:[string,string,string];answer:number;explanation:string};
const questions:Q[]=[
{topic:"ポジション",question:"6人テーブルでプリフロップに最初に行動するのは？",choices:["UTG","BTN","BB"],answer:0,explanation:"UTGはBBの左隣で、プリフロップでは最初にアクションします。"},
{topic:"ポジション",question:"フロップ以降、一般的に最後に行動しやすいポジションは？",choices:["SB","BTN","UTG"],answer:1,explanation:"BTNは通常、フロップ以降の各ストリートで最後に行動でき、情報面で有利です。"},
{topic:"プリフロップ",question:"UTGで72oが配られ、まだ誰も参加していない。基本の選択は？",choices:["レイズ","コール","フォールド"],answer:2,explanation:"UTGでは参加レンジを狭くし、弱い72oはフォールドが基本です。"},
{topic:"プリフロップ",question:"BTNでAKsが配られ、全員フォールド。基本の選択は？",choices:["レイズ","フォールド","チェック"],answer:0,explanation:"AKsは非常に強いハンドで、未参加ならレイズが基本です。"},
{topic:"レンジ",question:"『AJs』の s は何を意味する？",choices:["ストレート","同じスート","スペード限定"],answer:1,explanation:"sはsuitedで、2枚が同じスートであることを示します。"},
{topic:"レンジ",question:"『KQo』の o は何を意味する？",choices:["違うスート","オールイン","オープン"],answer:0,explanation:"oはoffsuitで、2枚が異なるスートであることを示します。"},
{topic:"役の強さ",question:"フラッシュとストレート、強いのは？",choices:["ストレート","フラッシュ","同じ強さ"],answer:1,explanation:"通常のテキサスホールデムではフラッシュがストレートより強い役です。"},
{topic:"役の強さ",question:"フルハウスとフォーカード、強いのは？",choices:["フルハウス","同じ強さ","フォーカード"],answer:2,explanation:"フォーカードはフルハウスより上位の役です。"},
{topic:"勝敗判定",question:"同じワンペアなら何で勝敗を比べる？",choices:["残りのキッカー","スートの強さ","先にベットした人"],answer:0,explanation:"ペアのランクを比較し、同じなら残りのカード（キッカー）を高い順に比較します。"},
{topic:"勝敗判定",question:"共通カード5枚が全員の最強ハンドの場合、勝敗は？",choices:["BTNが勝つ","引き分け","手札にAがある人が勝つ"],answer:1,explanation:"全員の最強5枚が同じならポットを分けます。"},
{topic:"ポットオッズ",question:"元のポット1,000、相手のベット500。コールに必要な勝率は？",choices:["25%","33.3%","50%"],answer:0,explanation:"500÷(1,000+500+500)=25%です。"},
{topic:"ポットオッズ",question:"リバーまで残り1枚で9アウト。概算の完成確率は？",choices:["約9%","約19%","約38%"],answer:1,explanation:"9/47≒19.1%です。ターン時点からリバーの1枚を見る前提です。"},
{topic:"ポットオッズ",question:"必要勝率25%、実際の勝率が35%なら、単純なチップEVでは？",choices:["フォールドが必ず有利","コールが計算上有利","必ず引き分け"],answer:1,explanation:"35%が25%を上回るため、前提どおりならコールの期待値はプラスです。"},
{topic:"実戦判断",question:"相手がレイズしたとき、未参加時と同じレンジで参加すべき？",choices:["常に同じ","全ハンドでコール","相手のレンジを考えて調整"],answer:2,explanation:"相手のポジションやレイズサイズに応じて、コール・3ベット・フォールドを調整します。"},
{topic:"実戦判断",question:"SBで弱いハンド。すでに0.5BB出しているので参加すべき？",choices:["必ず参加","投入済みチップにとらわれず判断","必ずオールイン"],answer:1,explanation:"すでに投入したチップはサンクコスト。追加の判断は今後の期待値で考えます。"}
];
export const GRADUATION_PASS_SCORE=12;
export function GraduationTest({onPass}:{onPass?:(score:number)=>void}){
 const [index,setIndex]=useState(0),[answers,setAnswers]=useState<number[]>([]),[finished,setFinished]=useState(false);
 const [saveStatus,setSaveStatus]=useState<"idle"|"saving"|"saved"|"login"|"error">("idle");
 const score=answers.reduce((s,a,i)=>s+(a===questions[i].answer?1:0),0),passed=score>=GRADUATION_PASS_SCORE;
 function choose(a:number){if(answers.length!==index)return;const next=[...answers,a];setAnswers(next);if(index===questions.length-1){setFinished(true);if(next.reduce((s,v,i)=>s+(v===questions[i].answer?1:0),0)>=GRADUATION_PASS_SCORE)onPass?.(next.reduce((s,v,i)=>s+(v===questions[i].answer?1:0),0));} }
 async function saveBadge(){setSaveStatus("saving");try{const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user){setSaveStatus("login");return;}const {data,error}=await supabase.rpc("submit_academy_graduation",{p_answers:answers});if(error||!data?.[0]?.passed){setSaveStatus("error");return;}setSaveStatus("saved");}catch{setSaveStatus("error");}}
 function reset(){setIndex(0);setAnswers([]);setFinished(false);setSaveStatus("idle")}
 const q=questions[index],selected=answers[index];
 return <section className={styles.root} aria-label="初心者卒業テスト">
 <header><span className={styles.eyebrow}>POKER SUMMIT · GRADUATION EXAM</span><h2>初心者卒業テスト</h2><p>ポジション・レンジ・役・ポットオッズ・実戦判断を総復習。15問中12問以上で合格です。</p></header>
 <div className={styles.progress}><span>{finished?"RESULT":`QUESTION ${index+1} / ${questions.length}`}</span><strong>{score} 問正解</strong></div><div className={styles.bar}><i style={{width:`${(finished?questions.length:index+1)/questions.length*100}%`}}/></div>
 {finished?<div className={styles.result} role="status"><div className={styles.medal}>{passed?"🏅":"♠"}</div><h3>{score} / {questions.length} 問正解</h3><strong>{passed?"合格！ 初心者卒業おめでとうございます":"あと少し！ 復習して再挑戦しましょう"}</strong><p>{passed?"各分野の基本をしっかり理解できています。":"各問題の解説を見直すと、次の挑戦につながります。"}</p>{passed && <div className={styles.saveBadge}><button type="button" disabled={saveStatus==="saving"||saveStatus==="saved"} onClick={saveBadge}>{saveStatus==="saving"?"保存中…":saveStatus==="saved"?"✓ 卒業バッジを保存しました":"🏅 会員バッジに合格を記録する"}</button>{saveStatus==="login"&&<p>バッジの保存にはログインが必要です。<Link href="/login?next=/learn">ログインする →</Link></p>}{saveStatus==="error"&&<p>保存できませんでした。時間をおいてもう一度お試しください。</p>}{saveStatus==="saved"&&<p>マイページとサミットに卒業バッジが表示されます。</p>}</div>}<button type="button" onClick={reset}>もう一度挑戦する ↻</button><p className={styles.note}>※合格した会員は「会員バッジに記録する」から保存できます。未ログインでもテストは受験できます。</p></div>:<div className={styles.quiz}><span className={styles.topic}>{q.topic}</span><h3>{q.question}</h3><div className={styles.choices}>{q.choices.map((c,i)=><button type="button" key={i} disabled={selected!==undefined} className={selected===i?styles.chosen:undefined} onClick={()=>choose(i)}>{c}</button>)}</div>{selected!==undefined&&<div className={styles.feedback} role="status"><strong>{selected===q.answer?"✓ 正解！":"復習ポイント"}　正解：{q.choices[q.answer]}</strong><p>{q.explanation}</p><button type="button" onClick={()=>setIndex(v=>v+1)}>{index===questions.length-1?"結果を見る →":"次の問題へ →"}</button></div>}</div>}
 <p className={styles.note}>※初心者向けの基本戦略を扱います。実戦では相手やルールにより最適な判断が変わる場合があります。</p></section>;
}

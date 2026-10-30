'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {explainQuiz,gradeQuiz,type QuizGrade,type QuizQuestion} from '@/lib/poker/gto-quiz';
import {quizCardRed,quizCardText} from '@/lib/poker/quiz-text';
import styles from './daily-quiz.module.css';

/** 今日のGTOクイズ: five questions, one at a time, graded against GTO with an explanation; at the end
 * 「今日は5問中◯問正解」 and a share button for X. Progress for today is kept in this browser. */
const cardText=quizCardText,red=quizCardRed;
function Cards({cards}:{cards:readonly number[]}){return <>{cards.map(c=><b key={c} className={styles.card} data-red={red(c)||undefined}>{cardText(c)}</b>)}</>;}
const KEY='poker-daily-quiz';
type Saved={date:string;answers:number[]};
function load(date:string):number[]{try{const v=JSON.parse(window.localStorage.getItem(KEY)??'null') as Saved|null;return v&&v.date===date&&Array.isArray(v.answers)?v.answers:[];}catch{return [];}}
function save(date:string,answers:number[]){try{window.localStorage.setItem(KEY,JSON.stringify({date,answers}));}catch{/* convenience only */}}

export function DailyQuiz({date,questions,member,url}:{date:string;questions:QuizQuestion[];member:boolean;url:string}){
 const [answers,setAnswers]=useState<number[]>([]),[at,setAt]=useState(0);
 useEffect(()=>{const a=load(date);setAnswers(a);setAt(Math.min(a.length,questions.length-1));},[date,questions.length]);
 const grades:QuizGrade[]=answers.map((c,i)=>gradeQuiz(questions[i],c));
 const done=answers.length>=questions.length,correct=grades.filter(g=>g.verdict==='正解').length;
 const q=questions[at],g=answers[at]!==undefined?grades[at]:null;
 const answer=(i:number)=>{if(answers.length!==at)return;const a=[...answers,i];setAnswers(a);save(date,a);};
 const shareText=`今日のGTOクイズ ${questions.length}問中${correct}問正解でした #PokerSummit`;
 const share=`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
 return <div className={styles.quiz}>
  <ol className={styles.steps} aria-label="問題の進み具合">{questions.map((_,i)=><li key={i} data-current={i===at||undefined} data-done={answers[i]!==undefined||undefined} data-verdict={grades[i]?.verdict}>
   <button type="button" disabled={i>answers.length} onClick={()=>setAt(i)} aria-label={`${i+1}問目`}>{i+1}</button></li>)}</ol>
  <section className={styles.question} aria-live="polite">
   <p className={styles.title}>{at+1}問目　{q.title}</p>
   <p className={styles.hand}>{q.board.length>0&&<><span>ボード</span><Cards cards={q.board}/></>}<span>あなた（{q.hero}）</span><Cards cards={q.cards}/></p>
   <p>{q.scene}あなたの番です。どうしますか？</p>
   <div className={styles.options}>{q.options.map((label,i)=><button key={i} type="button" disabled={Boolean(g)} aria-pressed={g?.choice===i} onClick={()=>answer(i)}>{label}</button>)}</div>
   {g&&<div className={styles.result} data-verdict={g.verdict}>
    <p><b>{g.verdict}</b>（{g.points}点）</p>
    <ul>{explainQuiz(q,g).map((line,i)=><li key={i}>{line}</li>)}</ul>
    {at<questions.length-1&&<button type="button" onClick={()=>setAt(at+1)}>次の問題</button>}
   </div>}
  </section>
  {done&&<section className={styles.summary}>
   <p><b>今日は{questions.length}問中{correct}問正解</b></p>
   <a className={styles.share} href={share} target="_blank" rel="noopener noreferrer">Xで結果をシェアする</a>
   <p className={styles.note}>新しい問題は毎日0時（日本時間）に入れ替わります。</p>
  </section>}
  <div className={styles.more}>
   {member?<><p>マイページのGTO練習クイズでは、6問目以降も続けて解けて、場面ごとの正解率も記録されます。</p><Link href="/mypage/poker">続けて解く</Link></>
    :<><p>会員登録（無料）すると、6問目以降の追加問題と、場面ごとの正解率の記録が使えます。</p><Link href="/signup">会員登録して続きを解く</Link></>}
  </div>
 </div>;
}

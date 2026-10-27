'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {GTO_SPOTS,loadFlop,loadFlopIndex} from '@/lib/poker/gto-spots';
import type {PreflopData} from '@/lib/poker/gto-bot';
import {explainQuiz,flopQuestion,gradeQuiz,preflopQuestion,type QuizGrade,type QuizQuestion} from '@/lib/poker/gto-quiz';
import styles from './gto-chart.module.css';

/** GTO practice (2026/10/27): preflop questions from the 6-max chart and flop questions from the computed flops.
 * The answer is graded against how often GTO takes each action with that hand, with an explanation. */
const R='23456789TJQKA',MARK='♣♦♥♠';
const cardText=(c:number)=>R[c>>2]+MARK[c&3];
const red=(c:number)=>(c&3)===1||(c&3)===2;
const SCORE_KEY='poker-gto-quiz-score';
type Score={count:number;points:number;right:number};
const emptyScore:Score={count:0,points:0,right:0};
function readScore():Score{try{const v=JSON.parse(window.localStorage.getItem(SCORE_KEY)??'null');return v&&typeof v.count==='number'?{...emptyScore,...v}:emptyScore;}catch{return emptyScore;}}
function writeScore(s:Score){try{window.localStorage.setItem(SCORE_KEY,JSON.stringify(s));}catch{/* score is a convenience only */}}

function Cards({cards}:{cards:readonly number[]}){
 return <>{cards.map(c=><b key={c} style={{color:red(c)?'#ff8a80':undefined,marginRight:4}}>{cardText(c)}</b>)}</>;
}

export function GtoQuiz(){
 const [mode,setMode]=useState<string>('all'),[index,setIndex]=useState<Record<string,string[]>>({});
 const [q,setQ]=useState<QuizQuestion|null>(null),[graded,setGraded]=useState<QuizGrade|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[score,setScore]=useState<Score>(emptyScore);
 const preflop=useRef<Promise<PreflopData|null>|null>(null);
 useEffect(()=>{setScore(readScore());void loadFlopIndex().then(setIndex);},[]);
 const loadPreflop=()=>{if(!preflop.current)preflop.current=fetch('/poker-gto/preflop.json').then(r=>r.ok?r.json() as Promise<PreflopData>:null).catch(()=>null);return preflop.current;};
 const next=useCallback(async()=>{
  setLoading(true);setError('');setGraded(null);
  try{
   const flopIndex=Object.keys(index).length?index:await loadFlopIndex();
   const flopPool=Object.entries(flopIndex).filter(([id,f])=>f.length&&(mode==='all'||id===mode));
   // 全部: about 4 in 10 questions are preflop.
   const wantPreflop=mode==='preflop'||(mode==='all'&&(Math.random()<0.4||!flopPool.length));
   if(wantPreflop){const data=await loadPreflop();const made=data&&preflopQuestion(data);if(made){setQ(made);return;}}
   for(let attempt=0;attempt<8&&flopPool.length;attempt++){
    const [spot,list]=flopPool[Math.floor(Math.random()*flopPool.length)],flop=list[Math.floor(Math.random()*list.length)];
    const data=await loadFlop(spot,flop);if(!data)continue;
    const info=GTO_SPOTS.find(s=>s.id===spot);
    const made=flopQuestion(data,`${info?.label??spot}・フロップ`,info?.detail??'');if(made){setQ(made);return;}
   }
   setError('問題を用意できませんでした。通信が不安定かもしれません。しばらくしてから試してください。');
  }catch{setError('問題を用意できませんでした。通信が不安定かもしれません。しばらくしてから試してください。');}
  finally{setLoading(false);}
 },[mode,index]);
 const asked=useRef('');
 useEffect(()=>{if(asked.current===mode)return;asked.current=mode;void next();},[mode,next]);
 const answer=(i:number)=>{
  if(!q||graded)return;const g=gradeQuiz(q,i);setGraded(g);
  setScore(s=>{const n={count:s.count+1,points:s.points+g.points,right:s.right+(g.verdict==='正解'?1:0)};writeScore(n);return n;});
 };
 const reset=()=>{setScore(emptyScore);writeScore(emptyScore);};
 const spotsWithData=GTO_SPOTS.filter(s=>index[s.id]?.length);
 return <div className={styles.wrap}>
  <p>GTOの計算結果から1問ずつ出題します。自分ならどう打つかを選ぶと、GTOがその手でそれぞれの打ち方を選ぶ割合と照らして採点し、解説を出します。いちばん多い打ち方を選べば100点、GTOが混ぜて使う打ち方は割合に応じた点数です。</p>
  <div className={styles.form}>
   <label>出題する場面<select value={mode} onChange={e=>setMode(e.target.value)}>
    <option value="all">全部</option><option value="preflop">プリフロップ</option>
    {spotsWithData.map(s=><option key={s.id} value={s.id}>{s.label}・フロップ</option>)}
   </select></label>
   <span role="status">{score.count?`${score.count}問・正解 ${score.right}問・平均 ${Math.round(score.points/score.count)}点`:'まだ解いていません'}</span>
   {score.count>0&&<button type="button" onClick={reset}>成績をリセット</button>}
  </div>
  {error&&<p role="alert">{error}</p>}
  {loading&&<p role="status">問題を用意しています…</p>}
  {q&&!loading&&<>
   <p className={styles.note}>{q.title}</p>
   <p>{q.board.length>0&&<><span>ボード </span><Cards cards={q.board}/>　</>}<span>あなた（{q.hero}） </span><Cards cards={q.cards}/></p>
   <p>{q.scene}あなたの番です。どうしますか？</p>
   <div className={styles.path}>{q.options.map((label,i)=><button key={i} type="button" disabled={Boolean(graded)} aria-pressed={graded?.choice===i} onClick={()=>answer(i)}>{label}</button>)}</div>
   {graded&&<div role="status">
    <p><b>{graded.verdict}</b>（{graded.points}点）</p>
    <ul style={{margin:'6px 0 10px',paddingLeft:18,display:'grid',gap:4}}>{explainQuiz(q,graded).map((line,i)=><li key={i}>{line}</li>)}</ul>
    <button type="button" onClick={()=>void next()}>次の問題</button>
   </div>}
  </>}
 </div>;
}

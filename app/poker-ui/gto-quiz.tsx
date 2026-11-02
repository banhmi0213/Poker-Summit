'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {GTO_SPOTS,loadFlop,loadFlopIndex} from '@/lib/poker/gto-spots';
import type {PreflopData} from '@/lib/poker/gto-bot';
import {PREFLOP_CATEGORY,explainQuiz,flopQuestion,gradeQuiz,preflopQuestion,type QuizGrade,type QuizQuestion} from '@/lib/poker/gto-quiz';
import styles from './gto-chart.module.css';
import { toQuizTop } from '@/lib/ui/quiz-top';

/** GTO practice (2026/10/27): preflop questions from the 6-max chart and flop questions from the computed flops.
 * The answer is graded against how often GTO takes each action with that hand, with an explanation.
 * Results are kept per member (poker_gto_quiz_*); without a login they stay in this browser. */
const R='23456789TJQKA',MARK='♣♦♥♠';
const cardText=(c:number)=>R[c>>2]+MARK[c&3];
const red=(c:number)=>(c&3)===1||(c&3)===2;
const LOCAL_KEY='poker-gto-quiz-score';
type Category={category:string;answered:number;points:number;correct:number};
type Score={answered:number;points:number;correct:number;categories:Category[]};
const emptyScore:Score={answered:0,points:0,correct:0,categories:[]};
const asScore=(v:unknown):Score|null=>{const o=v as Partial<Score>|null;return o&&typeof o.answered==='number'&&Array.isArray(o.categories)?{answered:o.answered,points:Number(o.points)||0,correct:Number(o.correct)||0,categories:o.categories as Category[]}:null;};
function readLocal():Score{try{return asScore(JSON.parse(window.localStorage.getItem(LOCAL_KEY)??'null'))??emptyScore;}catch{return emptyScore;}}
function writeLocal(s:Score){try{window.localStorage.setItem(LOCAL_KEY,JSON.stringify(s));}catch{/* convenience only */}}
function addLocal(s:Score,category:string,points:number):Score{
 const correct=points>=80?1:0,found=s.categories.find(c=>c.category===category);
 const categories=found?s.categories.map(c=>c===found?{...c,answered:c.answered+1,points:c.points+points,correct:c.correct+correct}:c):[...s.categories,{category,answered:1,points,correct}];
 return {answered:s.answered+1,points:s.points+points,correct:s.correct+correct,categories};
}
const rpc=async(name:string,args?:Record<string,unknown>)=>{const {createClient}=await import('@/lib/supabase/client');const {data,error}=await createClient().rpc(name,args);if(error)throw error;return asScore(data);};
export function categoryLabel(category:string){
 if(PREFLOP_CATEGORY[category])return PREFLOP_CATEGORY[category];
 const spot=GTO_SPOTS.find(s=>`flop-${s.id}`===category);return spot?`${spot.label}・フロップ`:category;
}
/** Weakest categories first (at least 3 answers), by average points. */
export function weakCategories(s:Score,limit=3){return s.categories.filter(c=>c.answered>=3).map(c=>({...c,average:c.points/c.answered})).sort((a,b)=>a.average-b.average).slice(0,limit);}

function Cards({cards}:{cards:readonly number[]}){
 return <>{cards.map(c=><b key={c} style={{color:red(c)?'#ff8a80':undefined,marginRight:4}}>{cardText(c)}</b>)}</>;
}

export function GtoQuiz(){
 const [mode,setMode]=useState<string>('all'),[index,setIndex]=useState<Record<string,string[]>>({});
 const [q,setQ]=useState<QuizQuestion|null>(null),[graded,setGraded]=useState<QuizGrade|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [score,setScore]=useState<Score>(emptyScore),[saved,setSaved]=useState<'member'|'browser'>('browser');
 const preflop=useRef<Promise<PreflopData|null>|null>(null);
 useEffect(()=>{
  let live=true;setScore(readLocal());void loadFlopIndex().then(i=>{if(live)setIndex(i);});
  // Signed-in members: results come from (and go to) the member record.
  rpc('poker_gto_quiz_stats').then(s=>{if(live&&s){setScore(s);setSaved('member');}}).catch(()=>{});
  return()=>{live=false;};
 },[]);
 const loadPreflop=()=>{if(!preflop.current)preflop.current=fetch('/poker-gto/preflop.json').then(r=>r.ok?r.json() as Promise<PreflopData>:null).catch(()=>null);return preflop.current;};
 const weak=weakCategories(score);
 const next=useCallback(async()=>{
  setLoading(true);setError('');setGraded(null);
  try{
   const flopIndex=Object.keys(index).length?index:await loadFlopIndex();
   // 苦手な場面: one of the weakest categories (falls back to everything until there are enough answers).
   const target=mode==='weak'&&weak.length?weak[Math.floor(Math.random()*weak.length)].category:null;
   const flopPool=Object.entries(flopIndex).filter(([id,f])=>f.length&&(target?target===`flop-${id}`:mode==='all'||mode==='weak'||id===mode));
   const wantPreflop=target?target.startsWith('preflop-'):mode==='preflop'||((mode==='all'||mode==='weak')&&(Math.random()<0.4||!flopPool.length));
   if(wantPreflop){const data=await loadPreflop();const made=data&&preflopQuestion(data,Math.random,target?target.slice('preflop-'.length):undefined);if(made){setQ(made);return;}}
   for(let attempt=0;attempt<8&&flopPool.length;attempt++){
    const [spot,list]=flopPool[Math.floor(Math.random()*flopPool.length)],flop=list[Math.floor(Math.random()*list.length)];
    const data=await loadFlop(spot,flop);if(!data)continue;
    const info=GTO_SPOTS.find(s=>s.id===spot);
    const made=flopQuestion(data,spot,`${info?.label??spot}・フロップ`,info?.detail??'');if(made){setQ(made);return;}
   }
   setError('問題を用意できませんでした。通信が不安定かもしれません。しばらくしてから試してください。');
  }catch{setError('問題を用意できませんでした。通信が不安定かもしれません。しばらくしてから試してください。');}
  finally{setLoading(false);}
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,index,score]);
 const asked=useRef('');
 useEffect(()=>{if(asked.current===mode)return;asked.current=mode;void next();},[mode,next]);
 const answer=(i:number)=>{
  if(!q||graded)return;const g=gradeQuiz(q,i);setGraded(g);
  const local=addLocal(score,q.category,g.points);setScore(local);
  if(saved==='member')rpc('poker_gto_quiz_record',{p_category:q.category,p_points:g.points}).then(s=>{if(s)setScore(s);}).catch(()=>{});
  else writeLocal(local);
 };
 const reset=()=>{
  if(saved==='member')rpc('poker_gto_quiz_reset').then(s=>setScore(s??emptyScore)).catch(()=>{});
  else{setScore(emptyScore);writeLocal(emptyScore);}
 };
 const spotsWithData=GTO_SPOTS.filter(s=>index[s.id]?.length);
 return <div className={styles.wrap} data-quiz-top>
  <p>GTOの計算結果から1問ずつ出題します。自分ならどう打つかを選ぶと、GTOがその手でそれぞれの打ち方を選ぶ割合と照らして採点し、解説を出します。いちばん多い打ち方を選べば100点、GTOが混ぜて使う打ち方は割合に応じた点数です。</p>
  <div className={styles.form}>
   <label>出題する場面<select value={mode} onChange={e=>setMode(e.target.value)}>
    <option value="all">全部</option><option value="weak">苦手な場面</option><option value="preflop">プリフロップ</option>
    {spotsWithData.map(s=><option key={s.id} value={s.id}>{s.label}・フロップ</option>)}
   </select></label>
   <span role="status">{score.answered?`${score.answered}問・正解 ${score.correct}問・平均 ${Math.round(score.points/score.answered)}点`:'まだ解いていません'}<small style={{display:'block',opacity:.75}}>{saved==='member'?'成績は会員ごとに保存されます':'成績はこのブラウザに保存されます（ログインすると会員ごとに保存）'}</small></span>
   {score.answered>0&&<button type="button" onClick={reset}>成績をリセット</button>}
  </div>
  {weak.length>0&&<p className={styles.note}>苦手な場面：{weak.map(c=>`${categoryLabel(c.category)} 平均${Math.round(c.average)}点`).join('・')}</p>}
  {mode==='weak'&&!weak.length&&<p className={styles.note}>同じ場面を3問以上解くと、苦手な場面から出題します。それまでは全部の場面から出題します。</p>}
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
    <button type="button" onClick={e=>{const t=e.currentTarget.closest('[data-quiz-top]');void next().then(()=>toQuizTop(t));}}>次の問題</button>
   </div>}
  </>}
 </div>;
}

'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {GtoReply,GtoRequest,DrillMode} from '@/lib/poker/gto.worker';
import type {TrainerSpot} from '@/lib/poker/gto-review';
import {HERO,LEVEL_TEXT,evLoss,gradeChoice,type TrainerHand,type TrainerLevel} from '@/lib/poker/gto-trainer';
import {CardChip,actText} from './gto-trainer';
import chart from './gto-chart.module.css';
import styles from './gto-trainer.module.css';

/** プリフロップ連打 (owner 2026/10/31, against Olympia's FastFold-style preflop trainer): one preflop decision after
 * another — a random seat and spot, the hero's two cards, GTO's menu as buttons. Each choice is graded at once (grade,
 * EV loss, GTO's shares) and the next hand comes up by itself; hands played off are kept for a 復習 round. Keys 1〜4
 * press the buttons. */
type Drill={hand:TrainerHand;spot:Extract<TrainerSpot,{source:'preflop'|'flop'|'solver'}>;mode:DrillMode};
type Result={choice:number;level:TrainerLevel;score:number;loss:number|null};
type Stats={n:number;best:number;good:number;score:number;evLoss:number;evCount:number};
const empty=():Stats=>({n:0,best:0,good:0,score:0,evLoss:0,evCount:0});
const KEY='poker-preflop-drill-stats';
const MODES:Record<string,{text:string;modes:DrillMode[]}>={mix:{text:'すべて（混ぜて出す）',modes:['rfi','vsOpen','vs3bet']},rfi:{text:'オープンするか',modes:['rfi']},vsOpen:{text:'オープンされた',modes:['vsOpen']},vs3bet:{text:'オープンして3ベットされた',modes:['vs3bet']}};
const read=():Stats=>{try{const v=JSON.parse(window.localStorage.getItem(KEY)??'null');return v&&typeof v.n==='number'?{...empty(),...v}:empty();}catch{return empty();}};
const write=(s:Stats)=>{try{window.localStorage.setItem(KEY,JSON.stringify(s));}catch{/* convenience only */}};
const pct=(x:number)=>`${Math.round(x*100)}%`;

export function PreflopDrill(){
 const [modeKey,setModeKey]=useState('mix'),[auto,setAuto]=useState(true),[cur,setCur]=useState<Drill|null>(null),[result,setResult]=useState<Result|null>(null);
 const [stats,setStats]=useState<Stats>(empty),[review,setReview]=useState<Drill[]>([]),[reviewing,setReviewing]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const worker=useRef<Worker|null>(null),seq=useRef(0),next=useRef<Promise<Drill|null>|null>(null),timer=useRef<number|null>(null);
 useEffect(()=>{setStats(read());return()=>{worker.current?.terminate();if(timer.current)window.clearTimeout(timer.current);};},[]);
 const ask=useCallback(async(build:(id:number)=>GtoRequest):Promise<GtoReply>=>{
  if(!worker.current){const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');worker.current=createGtoWorker();}
  const w=worker.current,id=++seq.current;
  return new Promise<GtoReply>(resolve=>{const guard=window.setTimeout(()=>{w.removeEventListener('message',on);resolve({type:'error',id,message:'timeout'});},20000);
   const on=(e:MessageEvent<GtoReply>)=>{if(e.data.id!==id)return;window.clearTimeout(guard);w.removeEventListener('message',on);resolve(e.data);};
   w.addEventListener('message',on);w.postMessage(build(id));});
 },[]);
 const fetchOne=useCallback((key:string)=>ask(id=>({type:'drill',id,modes:MODES[key].modes,seed:Math.floor(Math.random()*2**31)}))
  .then(r=>r.type==='drill'&&r.drill&&r.drill.spot.source!=='none'?r.drill as Drill:null),[ask]);
 // The next spot is fetched while the current one is on screen, so the next hand comes up at once.
 const show=useCallback(async(key:string,fromReview:Drill[]|null)=>{
  if(timer.current){window.clearTimeout(timer.current);timer.current=null;}
  setResult(null);setError('');
  if(fromReview){setReviewing(fromReview.length>0);if(fromReview.length){setCur(fromReview[0]);return;}}
  setLoading(true);
  const d=await (next.current??fetchOne(key));next.current=fetchOne(key);
  setLoading(false);
  if(d)setCur(d);else setError('問題を作れませんでした。もう一度押してください。');
 },[fetchOne]);
 const start=(key=modeKey)=>{next.current=null;setReviewing(false);void show(key,null);};

 const choose=useCallback((i:number)=>{
  if(!cur||result)return;const o=cur.spot.options;if(!o[i])return;
  const g=gradeChoice(o.map(x=>x.freq),i),raw=evLoss(o,i),loss=raw===null?null:g.level==='best'?0:raw;
  setResult({choice:i,level:g.level,score:g.score,loss});
  const ok=g.level==='best'||g.level==='correct';
  setStats(s=>{const n={...s,n:s.n+1,best:s.best+(g.level==='best'?1:0),good:s.good+(ok?1:0),score:s.score+g.score,
   ...(loss!==null?{evLoss:Math.round((s.evLoss+loss)*100)/100,evCount:s.evCount+1}:{})};write(n);return n;});
  let rest=review;
  if(reviewing)rest=ok?review.slice(1):[...review.slice(1),cur];
  else if(!ok)rest=[...review,cur].slice(-50);
  setReview(rest);
  if(auto)timer.current=window.setTimeout(()=>{void show(modeKey,reviewing?rest:null);},ok?600:1800);
 },[cur,result,review,reviewing,auto,show,modeKey]);
 const goNext=()=>{void show(modeKey,reviewing?review:null);};

 useEffect(()=>{
  const on=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
   const k=Number(e.key);if(k>=1&&k<=4){e.preventDefault();choose(k-1);}else if((e.key==='Enter'||e.key===' ')&&result){e.preventDefault();goNext();}};
  window.addEventListener('keydown',on);return()=>window.removeEventListener('keydown',on);
 });

 const scene=cur?cur.hand.log.filter(a=>a.street==='preflop').map(a=>`${cur.hand.positions[a.id]} ${actText(a.type,a.to,a.allIn)}`):[];
 return <div className={chart.wrap}>
  <p>プリフロップの判断だけを、テンポよく続けて練習します。座る場所と場面は毎回変わります。選ぶとすぐに採点し（GTOがその手で選ぶ割合とEV損失）、次の手が出ます。外した手は「復習」でもう一度出せます。キーボードの1〜4でも選べます。</p>
  <div className={chart.form}>
   <label>出す場面<select value={modeKey} onChange={e=>{setModeKey(e.target.value);if(cur)start(e.target.value);}}>{Object.entries(MODES).map(([k,m])=><option key={k} value={k}>{m.text}</option>)}</select></label>
   <label>自動で次へ<select value={auto?'on':'off'} onChange={e=>setAuto(e.target.value==='on')}><option value="on">する</option><option value="off">しない</option></select></label>
   {!cur&&<button type="button" disabled={loading} onClick={()=>start()}>連打を始める</button>}
   {review.length>0&&!reviewing&&<button type="button" onClick={()=>void show(modeKey,review)}>外した手を復習する（{review.length}）</button>}
   {reviewing&&<button type="button" onClick={()=>start()}>復習をやめる</button>}
  </div>
  {loading&&!cur&&<p role="status">問題を作っています…</p>}
  {error&&<p role="alert">{error}</p>}
  {cur&&<section aria-live="polite">
   <p className={styles.drillHead}>{reviewing&&<span className={styles.drillTag}>復習 残り{review.length}</span>}<b>{cur.hand.heroPos}</b>{scene.length?scene.join('、'):'誰も参加していません'}</p>
   <div className={styles.drillHand}><CardChip card={cur.hand.holes[HERO][0]}/><CardChip card={cur.hand.holes[HERO][1]}/></div>
   <div className={styles.actions}>{cur.spot.options.map((o,i)=><button key={i} type="button" data-kind={o.kind} disabled={!!result} aria-pressed={result?.choice===i} onClick={()=>choose(i)}>{o.text}</button>)}</div>
   {result&&<div className={styles.feedback} data-level={result.level}>
    <p><b>{LEVEL_TEXT[result.level]}</b><span>スコア {result.score}点</span>{result.loss!==null&&<span>{result.loss>0?`EV損失 ${result.loss.toFixed(2)}BB`:'EV損失なし'}</span>}</p>
    <p className={chart.note}>GTO：{cur.spot.options.map(o=>`${o.text} ${pct(o.freq)}`).join('・')}</p>
    {!auto&&<p><button type="button" onClick={goNext}>次の手</button></p>}
   </div>}
  </section>}
  <section className={styles.stats} aria-label="連打の成績">
   <p><b>成績</b><span>{stats.n}問</span><span>◎完璧 {stats.n?pct(stats.best/stats.n):'—'}</span><span>○良い以上 {stats.n?pct(stats.good/stats.n):'—'}</span><span>平均スコア {stats.n?Math.round(stats.score/stats.n):0}点</span>{stats.evCount>0&&<span>EV損失 平均 {(stats.evLoss/stats.evCount).toFixed(2)}BB</span>}</p>
   <button type="button" className={styles.reset} onClick={()=>{const s=empty();setStats(s);write(s);}}>成績をリセット</button>
  </section>
  <p className={chart.note}>6人卓・100BB・レーキなしの表で採点します（いちばん多い打ち方＝◎完璧、25%以上＝○良い、8%以上＝△惜しい、2%以上＝×ミス、それ未満＝××大きなミス）。△惜しい以下の手が復習に入り、復習で○良い以上を選ぶと外れます。成績はこのブラウザに保存されます。</p>
 </div>;
}

'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import rank from '@/data/poker-gto/preflop-rank.json';
import type {Combo,SolverSpot} from '@/lib/poker/postflop-solver';
import {cardText,classOf,type SolverView} from '@/lib/poker/solver-view';
import type {SolverReply,SolverRequest} from '@/lib/poker/solver.worker';
import styles from './gto-chart.module.css';
import picker from './card-picker.module.css';
import {CardGrid,CardSlot,parseCards} from './card-picker';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';

const R='AKQJT98765432';
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const PRESETS=[{id:'all',name:'全ハンド',top:1},{id:'50',name:'上位50%',top:0.5},{id:'30',name:'上位30%',top:0.3},{id:'15',name:'上位15%',top:0.15}];
/** Range = the strongest starting hands covering `top` of all deals (preflop rank order). */
function rangeCombos(top:number,board:number[]):Combo[]{
 const order:string[]=rank.order,combosOf=(l:string)=>l.length===2?6:l.endsWith('s')?4:12;let acc=0;const keep=new Set<string>();
 for(const l of order){if(acc>=top*1326-1e-9)break;keep.add(l);acc+=combosOf(l);}
 const out:Combo[]=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)if(!board.includes(a)&&!board.includes(b)&&keep.has(classOf(a,b)))out.push({c1:a,c2:b,weight:1});
 return out;
}
const pct=(v:number)=>`${Math.round(v*100)}%`;
// Turn: 33% / 75% / all-in, raise = all-in. River after the turn: 75% / all-in. River-only spots get the fuller menu.
const SIZES={turn:{betSizes:[0.33,0.75],raiseSizes:[],maxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1},river:{betSizes:[0.33,0.75],raiseSizes:[3],maxRaises:1}};
const LIMITS={turn:{target:0.01,maxIterations:150},river:{target:0.002,maxIterations:500}};

type Status={state:'idle'}|{state:'running';iterations:number;exploitability:number|null}|{state:'done';iterations:number;exploitability:number};

export function RiverSolverPanel(){
 const [cards,setCards]=useState<(number|null)[]>(()=>parseCards('Ah Td 7c 4s 2h')!),[active,setActive]=useState<number|null>(null);
 const [pot,setPot]=useState(10),[stack,setStack]=useState(50),[oop,setOop]=useState('50'),[ip,setIp]=useState('50');
 const [status,setStatus]=useState<Status>({state:'idle'}),[error,setError]=useState(''),[solvedBoard,setSolvedBoard]=useState<number[]>([]);
 const [steps,setSteps]=useState<number[]>([]),[view,setView]=useState<SolverView|null>(null);
 const worker=useRef<Worker|null>(null),viewId=useRef(0);
 useEffect(()=>()=>worker.current?.terminate(),[]);
 // Board = the first 4 (turn) or 5 (river) places, filled in order.
 const board=useMemo(()=>{const n=cards.findIndex(c=>c===null),filled=n<0?5:n;return (filled===4||filled===5)&&cards.slice(filled).every(c=>c===null)?cards.slice(0,filled) as number[]:null;},[cards]);
 const used=useMemo(()=>new Set(cards.filter((c):c is number=>c!==null)),[cards]);
 const pick=(code:number)=>{if(active===null)return;const next=cards.slice();next[active]=code;setCards(next);const e=next.findIndex(c=>c===null);setActive(e>=0&&e!==active?e:null);};
 const send=(m:SolverRequest)=>worker.current?.postMessage(m);
 const requestView=(next:number[])=>{setSteps(next);send({type:'view',id:++viewId.current,steps:next});};
 const start=()=>{
  if(!board){setError('ボードはフロップ3枚とターンの4枚（ターンから解く）か、リバーまでの5枚（リバーから解く）を左から順に選んでください。');return;}
  if(!(pot>0)||!(stack>0)){setError('ポットと残りチップは0より大きい数にしてください。');return;}
  setError('');const top=(id:string)=>PRESETS.find(p=>p.id===id)!.top,street=board.length===4?'turn':'river';
  const spot:SolverSpot={board,pot,stack,...SIZES[street],ranges:[rangeCombos(top(oop),board),rangeCombos(top(ip),board)]};
  worker.current?.terminate();
  const w=new Worker(new URL('../../lib/poker/solver.worker.ts',import.meta.url));worker.current=w;
  w.onmessage=(e:MessageEvent<SolverReply>)=>{const m=e.data;
   if(m.type==='progress')setStatus({state:'running',iterations:m.iterations,exploitability:m.exploitability});
   else if(m.type==='done'){setStatus({state:'done',iterations:m.iterations,exploitability:m.exploitability});setSteps([]);w.postMessage({type:'view',id:++viewId.current,steps:[]} satisfies SolverRequest);}
   else if(m.type==='view'){if(m.id===viewId.current)setView(m.view);}
   else setError(`計算できませんでした（${m.message}）`);};
  setSolvedBoard(board);setView(null);setSteps([]);setStatus({state:'running',iterations:0,exploitability:null});
  w.postMessage({type:'solve',spot,...LIMITS[street]} satisfies SolverRequest);
 };
 const running=status.state==='running';
 return <div className={styles.wrap}>
  <p>ターン（4枚目）かリバー（5枚目）からの2人勝負を、近似なしで解きます。ボード・ポット・残りチップ・お互いのレンジを決めると、手札ごとの正解の打ち方（チェック・ベット・コール・フォールドの割合）が出ます。</p>
  <p className={styles.note}>ベット額の前提：ターンはポットの33%・75%・オールイン、その後のリバーは75%・オールイン。リバーから解くときは33%・75%・3倍レイズ・オールイン。ターンからの計算はリバーのカードを全部解くので、20〜40秒ほどかかります。</p>
  <div role="group" aria-label="ボード"><p className={styles.note}>ボード（4枚ならターンから、5枚ならリバーから解きます）</p>
   <div className={picker.slots}>{cards.map((c,i)=><CardSlot key={i} card={c} name={`ボードの${i+1}枚目`} active={active===i} label={['','','フロップ','ターン','リバー'][i]} onClick={()=>setActive(a=>a===i?null:i)}/>)}</div>
   {active!==null&&<CardGrid title={`${['フロップの1枚目','フロップの2枚目','フロップの3枚目','ターン','リバー'][active]}`} blocked={new Set([...used].filter(x=>x!==cards[active]))} onPick={pick} onDone={()=>setActive(null)} onClear={()=>{const next=cards.slice();next[active]=null;setCards(next);}} typedPlaceholder="Ah Td 7c 4s 2h" onTyped={cs=>{if(cs.length>=4&&cs.length<=5){setCards([...cs,...new Array(5-cs.length).fill(null)]);}}}/>}
  </div>
  <div className={styles.form}>
   <label>ポット（BB）<input type="number" min={1} value={pot} onChange={e=>setPot(Number(e.target.value))}/></label>
   <label>残りチップ（BB）<input type="number" min={1} value={stack} onChange={e=>setStack(Number(e.target.value))}/></label>
   <label>OOP（先に打つ人）のレンジ<select value={oop} onChange={e=>setOop(e.target.value)}>{PRESETS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>IP（後に打つ人）のレンジ<select value={ip} onChange={e=>setIp(e.target.value)}>{PRESETS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   {running?<button type="button" onClick={()=>send({type:'stop'})}>ここで止めて表示</button>:<button type="button" onClick={start}>計算する</button>}
  </div>
  {error&&<p role="alert">{error}</p>}
  {status.state==='running'&&<p role="status">計算中… {status.iterations}回{status.exploitability!==null?` ・ 正解からのズレ：ポットの${(status.exploitability*100).toFixed(2)}%`:''}</p>}
  {status.state==='done'&&view&&<>
   <p className={styles.note}>ボード {solvedBoard.map(cardText).join(' ')} ・ {status.iterations}回計算 ・ 正解からのズレ：ポットの{(status.exploitability*100).toFixed(2)}%（最善の相手が得られる上積み）</p>
   <nav className={styles.path} aria-label="場面を選ぶ">
    <button type="button" onClick={()=>requestView([])} disabled={!steps.length}>最初から</button>
    {steps.length>0&&<button type="button" onClick={()=>requestView(steps.slice(0,-1))}>1つ戻る</button>}
    {view.trail.map((t,i)=><span key={i}>{t}</span>)}
   </nav>
   {view.kind==='chance'&&<label className={styles.stack}>リバーのカードを選ぶ<select value="" onChange={e=>e.target.value&&requestView([...steps,Number(e.target.value)])}>
    <option value="">選んでください</option>{view.cards!.map(c=><option key={c} value={c}>{cardText(c)}</option>)}</select></label>}
   {view.kind==='end'&&<p>この場面で勝負は終わりです。</p>}
   {view.kind==='act'&&<>
    <p><b>{view.street==='turn'?'ターン':'リバー'}・{view.player===0?'OOP（先に打つ人）':'IP（後に打つ人）'}の番</b>：全体では {view.actions!.map((a,i)=>`${a.label} ${pct(view.total![i])}`).join('・')}</p>
    <div className={styles.path}>{view.actions!.map((a,i)=>a.next?<button key={i} type="button" onClick={()=>requestView([...steps,i])}>「{a.label}」の後を見る</button>:null)}</div>
    <StrategyLegend actions={view.actions!}/><table className={styles.grid} aria-label="手札ごとの打ち方"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),e=view.classes![l];if(!e)return <td key={j} data-on="none">{l}</td>;
     let acc=0;const stops=view.actions!.map((a,ai)=>{const from=acc;acc+=e[ai+1]*100;return `${strategyColor(a,view.actions!)} ${from}% ${acc}%`;}).join(',');
     return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${view.actions!.map((a,ai)=>`${a.label} ${pct(e[ai+1])}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table>
    
   </>}
  </>}
 </div>;
}

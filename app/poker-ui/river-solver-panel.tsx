'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import rank from '@/data/poker-gto/preflop-rank.json';
import type {Combo,SolverSpot} from '@/lib/poker/postflop-solver';
import {cardText,classOf,type SolverView} from '@/lib/poker/solver-view';
import type {SolverReply,SolverRequest} from '@/lib/poker/solver.worker';
import styles from './gto-chart.module.css';

const R='AKQJT98765432',SUITS='cdhs';
const code=(s:string)=>{const r='23456789TJQKA'.indexOf(s[0].toUpperCase()),u=SUITS.indexOf(s[1].toLowerCase());return r<0||u<0?-1:r*4+u;};
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const PRESETS=[{id:'all',name:'全ハンド',top:1},{id:'50',name:'上位50%',top:0.5},{id:'30',name:'上位30%',top:0.3},{id:'15',name:'上位15%',top:0.15}];
/** Range = the strongest starting hands covering `top` of all deals (preflop rank order). */
function rangeCombos(top:number,board:number[]):Combo[]{
 const order:string[]=rank.order,combosOf=(l:string)=>l.length===2?6:l.endsWith('s')?4:12;let acc=0;const keep=new Set<string>();
 for(const l of order){if(acc>=top*1326-1e-9)break;keep.add(l);acc+=combosOf(l);}
 const out:Combo[]=[];for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)if(!board.includes(a)&&!board.includes(b)&&keep.has(classOf(a,b)))out.push({c1:a,c2:b,weight:1});
 return out;
}
const COLORS:Record<string,string>={check:'#4f8f74',call:'#4f8f74',fold:'#5a6b78',bet:'#d9b368',raise:'#d0784f',allin:'#b04a4a'};
const pct=(v:number)=>`${Math.round(v*100)}%`;
// Turn: 33% / 75% / all-in, raise = all-in. River after the turn: 75% / all-in. River-only spots get the fuller menu.
const SIZES={turn:{betSizes:[0.33,0.75],raiseSizes:[],maxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1},river:{betSizes:[0.33,0.75],raiseSizes:[3],maxRaises:1}};
const LIMITS={turn:{target:0.01,maxIterations:150},river:{target:0.002,maxIterations:500}};

type Status={state:'idle'}|{state:'running';iterations:number;exploitability:number|null}|{state:'done';iterations:number;exploitability:number};

export function RiverSolverPanel(){
 const [boardText,setBoardText]=useState('Ah Td 7c 4s 2h');
 const [pot,setPot]=useState(10),[stack,setStack]=useState(50),[oop,setOop]=useState('50'),[ip,setIp]=useState('50');
 const [status,setStatus]=useState<Status>({state:'idle'}),[error,setError]=useState(''),[solvedBoard,setSolvedBoard]=useState<number[]>([]);
 const [steps,setSteps]=useState<number[]>([]),[view,setView]=useState<SolverView|null>(null);
 const worker=useRef<Worker|null>(null),viewId=useRef(0);
 useEffect(()=>()=>worker.current?.terminate(),[]);
 const board=useMemo(()=>{const parts=boardText.trim().split(/\s+/);const cs=parts.map(p=>p.length===2?code(p):-1);return (parts.length===4||parts.length===5)&&cs.every(c=>c>=0)&&new Set(cs).size===parts.length?cs:null;},[boardText]);
 const send=(m:SolverRequest)=>worker.current?.postMessage(m);
 const requestView=(next:number[])=>{setSteps(next);send({type:'view',id:++viewId.current,steps:next});};
 const start=()=>{
  if(!board){setError('ボードは「Ah Td 7c 4s」（ターン）か「Ah Td 7c 4s 2h」（リバー）のように4枚か5枚、半角スペース区切りで入力してください（T=10、c♣ d♦ h♥ s♠）。');return;}
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
  <div className={styles.form}>
   <label>ボード<input value={boardText} onChange={e=>setBoardText(e.target.value)} placeholder="Ah Td 7c 4s 2h"/></label>
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
    <table className={styles.grid} aria-label="手札ごとの打ち方"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),e=view.classes![l];if(!e)return <td key={j} data-on="none">{l}</td>;
     let acc=0;const stops=view.actions!.map((a,ai)=>{const from=acc;acc+=e[ai+1]*100;return `${COLORS[a.kind]} ${from}% ${acc}%`;}).join(',');
     return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${view.actions!.map((a,ai)=>`${a.label} ${pct(e[ai+1])}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table>
    <p className={styles.legend}>{view.actions!.map((a,i)=><em key={i} className={styles.key}><i style={{background:COLORS[a.kind]}}/>{a.label}</em>)} 色の割合＝その手でその打ち方をする割合。灰色の枠はこの場面に来ない手。</p>
   </>}
  </>}
 </div>;
}

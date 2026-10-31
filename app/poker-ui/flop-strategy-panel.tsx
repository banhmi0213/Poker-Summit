'use client';
import {useEffect,useState} from 'react';
import {GTO_FLOPS,GTO_SPOTS,loadFlop,loadFlopIndex,seatOf,sizeNote,type FlopData} from '@/lib/poker/gto-spots';
import {nearestFlop,canonicalFlop} from '@/lib/poker/flop-subset';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';
import {FlopAggregate} from './flop-aggregate';
import {TurnExplorer} from './turn-explorer';

/** Precomputed flop solutions for 13 spots × up to 200 representative flops (2026/10/29: 95 → 200; the list shows only computed ones) (public/poker-gto/flops/<spot>/<flop>.json). */
export const FLOPS=GTO_FLOPS;
const R='AKQJT98765432',SUIT:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const flopText=(f:string)=>[0,2,4].map(i=>f[i]+SUIT[f[i+1]]).join(' ');
const pct=(v:number)=>`${Math.round(v*100)}%`;

export function FlopStrategyPanel({flops=FLOPS}:{flops?:string[]}){
 const [spot,setSpot]=useState<string>('btn-bb'),[flop,setFlop]=useState(flops[0]);
 const [data,setData]=useState<FlopData|null>(null),[error,setError]=useState('');
 const [trail,setTrail]=useState<number[]>([0]),[typed,setTyped]=useState(''),[nearNote,setNearNote]=useState('');
 const [index,setIndex]=useState<Record<string,string[]>|null>(null),[mode,setMode]=useState<'flop'|'summary'>('flop'),[explore,setExplore]=useState<number[]|null>(null);
 useEffect(()=>{void loadFlopIndex().then(setIndex);},[]);
 const ready=index?.[spot]??[],computed=(f:string)=>!index||ready.includes(f);
 useEffect(()=>{let live=true;setError('');setTrail([0]);setExplore(null);
  void loadFlop(spot,flop).then(d=>{if(!live)return;if(d)setData(d);else{setData(null);setError('この場面・フロップはまだ計算中です。別のフロップを選ぶか、しばらくしてから開いてください。');}});
  return ()=>{live=false;};},[spot,flop]);
 const lookup=()=>{const t=typed.replace(/\s+/g,'').replace(/(.)(.)/g,(_,r:string,su:string)=>r.toUpperCase()+su.toLowerCase());const c=canonicalFlop(t);if(!c){setNearNote('「Kh7d2c」のように3枚を入力してください（T=10、c♣ d♦ h♥ s♠）。');return;}
  const n=nearestFlop(t,ready.length?ready:flops);if(!n)return;setFlop(n.flop);setNearNote(n.exact?(n.flop===t?`${flopText(t)} は計算済みです。`:`${flopText(t)} はスートの入れ替えだけ違う ${flopText(n.flop)} と同じ形なので、その計算結果を表示しています（手札の表は同じになります）。`):`${flopText(t)} にいちばん近い計算済みのフロップ ${flopText(n.flop)} を表示しています（スートの並びと高いカードが近いもの）。`);};
 const node=data?data.nodes[trail[trail.length-1]]:null;
 const flopPath=data?trail.slice(1).map((n,i)=>data.nodes[trail[i]].children.indexOf(n)):[];
 const who=(p:number)=>data!.spot.order?`${seatOf(data!,p)}（${p+1}番目に打つ人）`:p===0?`${data!.spot.oop}（先に打つ人）`:`${data!.spot.ip}（後に打つ人）`;
 const current=GTO_SPOTS.find(s=>s.id===spot)!;
 // Per-hand EV (version 3) is the value from the start of the flop: shown on the first decision of each player only.
 const evSide:'oop'|null=data&&node&&data.handEv&&!data.spot.order&&trail.length===1?'oop':null;
 return <div className={styles.wrap}><div className={styles.split} data-on={mode==='flop'&&data&&node?'':undefined}><div className={styles.splitSide}>
  <p>よくある場面とフロップを前もって計算した、フロップでの正解の打ち方です。ターン・リバーのカードまで全部計算しています。</p>
  <p className={styles.note}>{(data&&sizeNote(data.spot.sizes,!!data.multiway))??'ベット額の前提：シングルレイズはフロップ33%・75%と3倍レイズ、3ベットポットは33%・66%と2.5倍レイズ、4ベットポットは33%。ターン66%・リバー75%（オールインはポットの1.5倍以内のときだけ）。'}お互いのレンジはプリフロップの表から出したレンジです。</p>
  <div className={styles.form}>
   <label>場面<select value={spot} onChange={e=>setSpot(e.target.value)}>{[...new Set(GTO_SPOTS.map(s=>s.group))].map(g=><optgroup key={g} label={g}>{GTO_SPOTS.filter(s=>s.group===g).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>)}</select></label>
   <label>フロップを選ぶ<select value={flop} onChange={e=>{setFlop(e.target.value);setNearNote('');}}>{flops.filter(f=>computed(f)||f===flop).map(f=><option key={f} value={f}>{flopText(f)}{computed(f)?'':'（計算中）'}</option>)}</select></label>
   <label>好きなフロップで探す<input value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')lookup();}} placeholder="Kh7d2c"/></label>
   <button type="button" onClick={lookup}>近いフロップを表示</button>
  </div>
  <p className={styles.note}>{current.detail}{index?`（計算済み ${ready.length}／${flops.length}フロップ）`:''}</p>
  <nav className={styles.path} aria-label="表示を選ぶ">
   <button type="button" onClick={()=>setMode('flop')} disabled={mode==='flop'}>フロップごとの表</button>
   <button type="button" onClick={()=>setMode('summary')} disabled={mode==='summary'}>全体まとめ</button>
  </nav>
  {mode==='flop'&&<>
  {nearNote&&<p role="status" className={styles.note}>{nearNote}</p>}
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p role="status" data-loading>読み込み中…</p>}
  {data&&node&&<>
   <p className={styles.note}>ボード {flopText(data.flop)} ・ {data.iterations}回計算 ・ 正解からのズレ：ポットの{data.exploitability.toFixed(2)}%{(data.version??0)>=3?'（リバーを計算途中の戦略で測るため、実際より大きめに出ます）':''}</p>
   {data.ev&&!data.spot.order&&<p className={styles.note}>フロップ開始時点の取り分：{data.spot.oop} {data.ev.oop.toFixed(1)}BB・{data.spot.ip} {data.ev.ip.toFixed(1)}BB（ポット{data.spot.pot}BB）{evSide!==null?'。マスにカーソルを当てると、その手の期待値も出ます。':''}</p>}
   <nav className={styles.path} aria-label="場面を選ぶ">
    <button type="button" onClick={()=>setTrail([0])} disabled={trail.length===1}>最初から</button>
    {trail.length>1&&<button type="button" onClick={()=>setTrail(t=>t.slice(0,-1))}>1つ戻る</button>}
    {trail.slice(1).map((n,i)=>{const parent=data.nodes[trail[i]],a=parent.children.indexOf(n);return <span key={i}>{seatOf(data,parent.player)} {parent.actions[a].label}</span>;})}
   </nav>
   <p><b>{who(node.player)}の番</b>：全体では {node.actions.map((a,i)=>`${a.label} ${pct(node.total[i])}`).join('・')}</p>
   <div className={styles.path}>{node.actions.map((a,i)=>node.children[i]!==null?<button key={i} type="button" onClick={()=>setTrail(t=>[...t,node.children[i]!])}>「{a.label}」の後を見る</button>
    :!data.spot.order&&data.spot.sizes&&(a.kind==='check'||a.kind==='call')?<button key={i} type="button" onClick={()=>setExplore([...flopPath,i])}>「{a.label}」のあとのターン・リバーを見る</button>:null)}</div>
   
   
  </>}
  </>}
 </div>
 {mode==='flop'&&data&&node&&<div className={styles.splitMain}><StrategyLegend actions={node.actions}/><table className={styles.grid} aria-label="手札ごとの打ち方"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),e=node.classes[l];if(!e||e[0]<=0)return <td key={j} data-on="none">{l}</td>;
    let acc=0;const stops=node.actions.map((a,ai)=>{const from=acc;acc+=e[ai+1]*100;return `${strategyColor(a,node.actions)} ${from}% ${acc}%`;}).join(',');
    return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${node.actions.map((a,ai)=>`${a.label} ${pct(e[ai+1])}`).join('・')}${evSide&&data.handEv?.[evSide]?.[l]!==undefined?`・期待値 ${data.handEv[evSide][l].toFixed(1)}BB`:''}`}>{l}</td>;})}</tr>)}</tbody></table></div>}
 </div>
  {mode==='summary'&&<FlopAggregate spot={spot} onPick={f=>{setFlop(f);setNearNote('');setMode('flop');}}/>}
 {mode==='flop'&&data&&node&&explore&&<TurnExplorer spot={spot} data={data} path={explore} lineText={(()=>{let n=0;return explore.map(i=>{const x=data.nodes[n],t=`${seatOf(data,x.player)} ${x.actions[i].label}`;n=x.children[i]??0;return t;}).join('、');})()}/>}
 </div>;
}

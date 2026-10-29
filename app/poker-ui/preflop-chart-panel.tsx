'use client';
import {useEffect,useMemo,useState} from 'react';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';

/** 6-max 100BB preflop charts from the simplified preflop solve (scripts/poker-gto/preflop-solve.cjs → public/poker-gto/preflop.json). */
type Node={id:number;player:string;history:string;kind:string;title:string;actions:{label:string;kind:string}[];strategy:Record<string,number[]>};
type Data={iterations:number;averageRegret:number;assumptions:string[];nodes:Node[]};
const KINDS6=[['open','オープン（誰も参加していない）'],['vsLimp','SBにリンプされた（BB）'],['vsIso','リンプ後にBBにレイズされた（SB）'],['vsOpen','オープンされた'],['overcall','オープンとコールが入った'],['vsSqueeze','スクイーズされた'],['vs3bet','3ベットされた'],['vs4bet','4ベットされた'],['vs5bet','オールインされた']] as const;
// Heads-up chart (2026/10/29): the button is the SB, limps are allowed.
const KINDSHU=[['open','SB（ボタン）の最初の行動'],['vsLimp','リンプされた（BB）'],['vsIso','リンプ後にレイズされた（SB）'],['vsOpen','オープンされた（BB）'],['vs3bet','3ベットされた'],['vs4bet','4ベットされた'],['vs5bet','オールインされた']] as const;
const R='AKQJT98765432';
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const combos=(l:string)=>l.length===2?6:l[2]==='s'?4:12;
const pct=(v:number)=>`${Math.round(v*100)}%`;

export function PreflopChartPanel(){
 const [table,setTable]=useState<'6max'|'hu'>('6max'),[depth,setDepth]=useState<number>(100),[data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[kind,setKind]=useState<string>('open'),[id,setId]=useState<number|null>(null);
 const KINDS=table==='hu'?KINDSHU:KINDS6;
 useEffect(()=>{let live=true;setData(null);fetch(table==='hu'?'/poker-gto/preflop-hu.json':depth===100?'/poker-gto/preflop.json':`/poker-gto/preflop-${depth}bb.json`).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(live)setData(d);}).catch(()=>{if(live)setError('プリフロップ表を読み込めませんでした。');});return()=>{live=false;};},[table,depth]);
 const options=useMemo(()=>data?.nodes.filter(n=>n.kind===kind)??[],[data,kind]);
 const node=options.find(n=>n.id===id)??options[0]??null;
 const totals=useMemo(()=>{if(!node)return [];const k=node.actions.length,t=new Array(k).fill(0);let all=0;for(const [l,v] of Object.entries(node.strategy)){const c=combos(l);all+=c;for(let a=0;a<k;a++)t[a]+=c*v[a];}return t.map(x=>x/all);},[node]);
 return <div className={styles.wrap}>
  <p>プリフロップの打ち方を、計算で求めた表です（6人卓と2人のときを切り替えられます。2人のときはボタンがSBで、リンプもあります）。6人卓は100BBのほか、大会向けに60・40・20BB（BBアンティあり）の表もあります。立場ごとに、手札ごとのオープン・コール・3ベットなどの割合を色で表しています。</p>
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p role="status">読み込み中…</p>}
  {data&&<>
   <div className={styles.form}>
    <label>人数<select value={table} onChange={e=>{setTable(e.target.value as '6max'|'hu');setKind('open');setId(null);}}><option value="6max">6人卓</option><option value="hu">2人（ヘッズアップ）</option></select></label>
    {table==='6max'&&<label>スタック<select value={depth} onChange={e=>{setDepth(Number(e.target.value));setId(null);}}><option value={100}>100BB（アンティなし）</option><option value={60}>60BB（大会・BBアンティ）</option><option value={40}>40BB（大会・BBアンティ）</option><option value={20}>20BB（大会・BBアンティ）</option></select></label>}
    <label>状況<select value={kind} onChange={e=>{setKind(e.target.value);setId(null);}}>{KINDS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    <label>立場<select value={node?.id??''} onChange={e=>setId(Number(e.target.value))}>{options.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
   </div>
   {node&&<>
    <p><b>{node.title}</b>：全体では {node.actions.map((a,i)=>`${a.label} ${pct(totals[i]??0)}`).join('・')}</p>
    <StrategyLegend actions={node.actions}/><table className={styles.grid} aria-label="手札ごとの打ち方"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),e=node.strategy[l];if(!e)return <td key={j} data-on="none">{l}</td>;
     let acc=0;const stops=node.actions.map((a,ai)=>{const from=acc;acc+=e[ai]*100;return `${strategyColor(a,node.actions)} ${from}% ${acc}%`;}).join(',');
     return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${node.actions.map((a,ai)=>`${a.label} ${pct(e[ai])}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table>
    
   </>}
   <details className={styles.note}><summary>計算の前提</summary><ul>{data.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul><p>{data.iterations.toLocaleString()}回計算・平均の取り逃し {data.averageRegret.toFixed(4)}BB。6人分を厳密に解くのは計算が重すぎるため、上の前提で簡略化しています。フロップ以降の正解は「フロップ戦略」を見てください。</p></details>
  </>}
 </div>;
}

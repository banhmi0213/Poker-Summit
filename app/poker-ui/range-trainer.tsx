'use client';
import {useEffect,useMemo,useState} from 'react';
import {cachedJson,loadJson} from '@/lib/poker/gto-spots';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';
import {ChipRow,HandDetail} from './hand-detail';

/** Range trainer (2026/10/30): pick a preflop spot, paint the hands you would play (open / call / 3-bet …), then
 * compare with the GTO chart. The score counts combos: hands GTO plays that you left out and hands you added that GTO
 * folds both cost points, weighted by how often GTO plays them. */
const R='AKQJT98765432';
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const combos=(l:string)=>l.length===2?6:l[2]==='s'?4:12;
type Node={id:number;player:string;title:string;kind:string;actions:{label:string;kind:string}[];strategy:Record<string,number[]>};
type Data={nodes:Node[]};
const SPOT_KINDS=[['open','オープン（誰も参加していない）'],['vsOpen','オープンされた'],['vs3bet','3ベットされた']] as const;
const KIND_SHORT:Record<string,string>={open:'オープン',vsOpen:'オープンされた',vs3bet:'3ベットされた'};
const SEATS=['UTG','HJ','CO','BTN','SB','BB'];
// Short chip label for the other player: who opened (オープンされた) or who 3-bet (3ベットされた).
const foe=(t:string)=>{const m=t.match(/([A-Z+0-9]+)が3ベット/)??t.match(/^([A-Z+0-9]+)のオープン/);const who=m?m[1]:t.replace(/\s*→\s*\S+$/,'');return t.includes('リンプ')?`${who}（リンプ後）`:who;};

export function RangeTrainer(){
 const [depth,setDepth]=useState(100),[data,setData]=useState<Data|null>(()=>cachedJson<Data>('/poker-gto/preflop.json')??null),[kind,setKind]=useState<string>('open'),[id,setId]=useState<number|null>(null);
 const [pick,setPick]=useState<Record<string,number>>({}),[shown,setShown]=useState(false),[brush,setBrush]=useState(1),[look,setLook]=useState<string|null>(null);
 const url=depth===100?'/poker-gto/preflop.json':`/poker-gto/preflop-${depth}bb.json`;
 useEffect(()=>{let live=true;const c=cachedJson<Data>(url);if(c){setData(c);return;}void loadJson<Data>(url).then(d=>{if(live&&d)setData(d);});return()=>{live=false;};},[url]);
 // Seats in table order (UTG first), as the preflop chart titles start with the seat.
 const ORDER=['UTG','HJ','CO','BTN','SB','BB'],seatOf=(t:string)=>{const who=t.includes('→')?t.split('→').pop()!.trim():t;const i=ORDER.findIndex(p=>who.startsWith(p));return i<0?9:i;};
 const options=useMemo(()=>(data?.nodes.filter(n=>n.kind===kind)??[]).slice().sort((x,y)=>seatOf(x.title)-seatOf(y.title)),[data,kind]);
 const node=options.find(n=>n.id===id)??options[0]??null;
 const seats=useMemo(()=>[...new Set(options.map(n=>n.player))].sort((a,b)=>SEATS.indexOf(a)-SEATS.indexOf(b)),[options]);
 const mine=options.filter(n=>n.player===node?.player);
 // New spot: clear the board and paint with its raise (open / 3-bet …) by default.
 useEffect(()=>{setPick({});setShown(false);setLook(null);const r=node?node.actions.findIndex(a=>a.kind==='raise'||a.kind==='allin'):-1;setBrush(r>=0?r:1);},[node?.id,depth]);
 if(!data)return <p role="status" data-loading>読み込み中…</p>;
 // Actions you can paint: everything except fold (the unpainted cells fold).
 const acts=node?node.actions.map((a,i)=>({...a,i})).filter(a=>a.kind!=='fold'&&a.kind!=='check'):[];
 const foldI=node?node.actions.findIndex(a=>a.kind==='fold'||a.kind==='check'):-1;
 const score=()=>{if(!node)return null;let err=0;
  for(const [l,row] of Object.entries(node.strategy) as [string,number[]][]){const c=combos(l),mine=pick[l];
   // GTO share of each action vs. what you painted (1 for the painted action, the rest fold).
   node.actions.forEach((_,a)=>{const want=row[a]??0,got=mine===undefined?(a===foldI?1:0):(a===mine?1:0);err+=c*Math.abs(want-got)/2;});}
  // Normalised by how many combos either side plays, so painting nothing (or everything) scores 0.
  let G=0,U=0;for(const [l,row] of Object.entries(node.strategy) as [string,number[]][]){const c=combos(l);G+=c*(1-(row[foldI]??0));if(pick[l]!==undefined)U+=c;}
  return G+U>0?Math.max(0,Math.round(100*(1-2*err/(G+U)))):100;};
 const paint=(l:string)=>{if(shown){setLook(l);return;}setPick(p=>{const n={...p};if(n[l]===brush)delete n[l];else n[l]=brush;return n;});};
 const all=node?.actions??[];
 return <div className={styles.wrap}><div className={styles.split} data-on={node?'':undefined}><div className={styles.splitSide}>
  <p className={styles.intro}>場面を選んで、自分ならプレイする手をマスを押して塗ってください。「答え合わせ」でGTOの表と比べて採点します（塗らなかった手はフォールド）。</p>
  <details className={styles.aboutMobile}><summary>遊び方</summary><p>自分ならプレイする手をマスを押して塗ります。「答え合わせ」でGTOの表と比べて採点します（塗らなかった手はフォールド）。答え合わせのあとにマスを押すと、その手のGTOの割合が出ます。</p></details>
  <div className={styles.form}>
   <label>スタック<select value={depth} onChange={e=>{setDepth(Number(e.target.value));setId(null);}}><option value={100}>100BB</option><option value={60}>60BB（大会）</option><option value={40}>40BB（大会）</option><option value={20}>20BB（大会）</option><option value={10}>10BB（大会）</option></select></label>
   <label className={styles.desktopOnly}>状況<select value={kind} onChange={e=>{setKind(e.target.value);setId(null);}}>{SPOT_KINDS.map(([k,t])=><option key={k} value={k}>{t}</option>)}</select></label>
   <label className={styles.desktopOnly}>立場<select value={node?.id??''} onChange={e=>setId(Number(e.target.value))}>{options.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
  </div>
  <div className={styles.chips}>
   <ChipRow label="状況" value={kind} options={SPOT_KINDS.map(([k])=>({value:k as string,label:KIND_SHORT[k]}))} onChange={v=>{setKind(v);setId(null);}}/>
   {seats.length>1&&<ChipRow label="自分の席" value={node?.player??''} options={seats.map(p=>({value:p,label:p}))} onChange={p=>setId(options.find(n=>n.player===p)?.id??null)}/>}
   {mine.length>1&&<ChipRow label={kind==='vs3bet'?'3ベットした人':'オープンした人'} value={node?.id??-1} options={mine.map(n=>({value:n.id,label:foe(n.title)}))} onChange={v=>setId(v)}/>}
  </div>
  {node&&<>
   <div className={`${styles.path} ${styles.brushes}`}>{acts.map(a=><button key={a.i} type="button" onClick={()=>setBrush(a.i)} aria-pressed={brush===a.i}><i style={{background:strategyColor(a,all)}} aria-hidden="true"/>{a.label}で塗る</button>)}
    <button type="button" onClick={()=>{setPick({});setShown(false);}}>全部消す</button>
    <button type="button" onClick={()=>setShown(s=>!s)}>{shown?'自分の塗りに戻る':'答え合わせ'}</button></div>
   {shown&&<p className={styles.score}><b>点数：{score()}点</b>（100点満点。GTOが混ぜる手は、多く選ぶほうに塗れていれば近い点になります）</p>}
   
   {shown&&<p className={styles.note}>金の枠は、自分の塗りがGTOの一番多い選び方と違う手です。</p>}
  </>}
 </div>
 {node&&<div className={styles.splitMain}><StrategyLegend actions={all}/><table className={styles.grid} aria-label={shown?'GTOの答え':'自分のレンジ'} data-hide-back-to-top><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j);
    if(shown){const row=node.strategy[l];if(!row)return <td key={j} data-on="none" onClick={()=>setLook(l)} data-pick={look===l?'':undefined}>{l}</td>;let acc=0;const stops=all.map((a,ai)=>{const from=acc;acc+=(row[ai]??0)*100;return `${strategyColor(a,all)} ${from}% ${acc}%`;}).join(',');
     const miss=pick[l]===undefined?row[foldI]<0.5:(row[pick[l]]??0)<0.5;
     return <td key={j} onClick={()=>setLook(l)} data-pick={look===l?'':undefined} data-on="mix" data-hero={miss||undefined} style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${all.map((a,ai)=>`${a.label} ${Math.round((row[ai]??0)*100)}%`).join('・')}`}>{l}</td>;}
    const p=pick[l];return <td key={j} data-on={p===undefined?'none':'mix'} style={p===undefined?undefined:{background:strategyColor(all[p],all),cursor:'pointer'}} onClick={()=>paint(l)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();paint(l);}}}>{l}</td>;})}</tr>)}</tbody></table>
  {shown&&<HandDetail hand={look} actions={all} freqs={look?node.strategy[look]:null} note={look?`自分の塗り：${pick[look]===undefined?'フォールド':all[pick[look]]?.label}`:undefined}/>}</div>}
 </div>
 </div>;
}

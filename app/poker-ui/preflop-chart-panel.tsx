'use client';
import {useEffect,useMemo,useState} from 'react';
import {cachedJson,loadJson} from '@/lib/poker/gto-spots';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';
import {ChipRow,HandDetail} from './hand-detail';
import {RAKE_CHARTS} from '@/lib/poker/ring-rake';

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
const SEATS=['UTG','UTG+1','UTG+2','MP','LJ','HJ','CO','BTN','SB','BB'];
// The situation without the seat: 「BTNのオープン → BB」 → 「BTNのオープン」, 「SB：誰も参加していない…」 → 「誰も参加していない…」.
const shortTitle=(t:string)=>t.replace(/\s*→\s*\S+$/,'').replace(/^[A-Z+0-9]+：/,'');
const KIND_SHORT:Record<string,string>={open:'オープン',vsLimp:'リンプされた',vsIso:'リンプ後レイズ',vsOpen:'オープンされた',overcall:'オープン＋コール',vsSqueeze:'スクイーズ',vs3bet:'3ベットされた',vs4bet:'4ベットされた',vs5bet:'オールイン'};

type Table='6max'|'8max'|'9max'|'hu';
/** standard / pro: the member's plan (lib/poker/gto-access). 8/9-max charts are スタンダード (tournament depths プロ); with
 * upsell a free member sees them in the menu with a button to /pricing instead of the chart. All off while paid features are hidden. */
export function PreflopChartPanel({standard=false,pro=false,upsell=false}:{standard?:boolean;pro?:boolean;upsell?:boolean}={}){
 const [table,setTable]=useState<Table>('6max'),[depth,setDepth]=useState<number>(100),[rake,setRake]=useState(''),[data,setData]=useState<Data|null>(()=>cachedJson<Data>('/poker-gto/preflop.json')??null),[error,setError]=useState(''),[kind,setKind]=useState<string>('open'),[id,setId]=useState<number|null>(null),[pick,setPick]=useState<string|null>(null);
 const KINDS=table==='hu'?KINDSHU:KINDS6;
 const many=table==='8max'||table==='9max',paidName=many?`preflop-${table}${depth!==100?`-${depth}bb`:rake?`-rake${rake}`:''}`:'';
 // A paid chart the member's plan does not cover: no request, a note with the plan instead.
 const locked=many&&(depth!==100?!pro:!standard);
 const url=locked?'':many?`/api/poker/gto-charts/${paidName}`:table==='hu'?'/poker-gto/preflop-hu.json':depth===100?(rake?`/poker-gto/preflop-rake${rake}.json`:'/poker-gto/preflop.json'):`/poker-gto/preflop-${depth}bb.json`;
 useEffect(()=>{if(!url)return;let live=true;const c=cachedJson<Data>(url);if(c){setData(c);setError('');return;}void loadJson<Data>(url).then(d=>{if(!live)return;if(d){setData(d);setError('');}else{setData(null);setError('プリフロップ表を読み込めませんでした。');}});return()=>{live=false;};},[url]);
 const options=useMemo(()=>data?.nodes.filter(n=>n.kind===kind)??[],[data,kind]);
 const node=options.find(n=>n.id===id)??options[0]??null;
 const seats=useMemo(()=>[...new Set(options.map(n=>n.player))].sort((a,b)=>SEATS.indexOf(a)-SEATS.indexOf(b)),[options]);
 const mine=node?options.filter(n=>n.player===node.player):[];
 const totals=useMemo(()=>{if(!node)return [];const k=node.actions.length,t=new Array(k).fill(0);let all=0;for(const [l,v] of Object.entries(node.strategy)){const c=combos(l);all+=c;for(let a=0;a<k;a++)t[a]+=c*v[a];}return t.map(x=>x/all);},[node]);
 return <div className={styles.wrap}><div className={styles.split} data-on={data&&node&&!locked?'':undefined}><div className={styles.splitSide}>
  <p className={styles.intro}>プリフロップの打ち方を、計算で求めた表です（6人卓と2人のときを切り替えられます。2人のときはボタンがSBで、リンプもあります）。6人卓は100BBのほか、大会向けに60・40・20・10BB（BBアンティあり）の表と、キャッシュゲーム向けにレーキ（5%・10%）ありの表もあります。立場ごとに、手札ごとのオープン・コール・3ベットなどの割合を色で表しています。</p>
  <details className={styles.aboutMobile}><summary>この表について</summary><p>プリフロップの打ち方を、計算で求めた表です（6人卓と2人のときを切り替えられます。2人のときはボタンがSBで、リンプもあります）。6人卓は100BBのほか、大会向けに60・40・20・10BB（BBアンティあり）の表と、キャッシュゲーム向けにレーキ（5%・10%）ありの表もあります。立場ごとに、手札ごとのオープン・コール・3ベットなどの割合を色で表しています。</p></details>
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p role="status" data-loading>読み込み中…</p>}
  {data&&<>
   <div className={styles.form}>
    <label>人数<select value={table} onChange={e=>{const t=e.target.value as Table;setTable(t);if(t==='hu')setDepth(100);setKind('open');setId(null);}}><option value="6max">6人卓</option>{(standard||upsell)&&<><option value="8max">8人卓{standard?'':'（スタンダード）'}</option><option value="9max">9人卓{standard?'':'（スタンダード）'}</option></>}<option value="hu">2人（ヘッズアップ）</option></select></label>
    {(table==='6max'||(many&&(pro||upsell||standard)))&&<label>スタック<select value={depth} onChange={e=>{setDepth(Number(e.target.value));setId(null);}}><option value={100}>100BB（アンティなし）</option><option value={60}>60BB（大会・BBアンティ）</option><option value={40}>40BB（大会・BBアンティ）</option><option value={20}>20BB（大会・BBアンティ）</option><option value={10}>10BB（大会・BBアンティ）</option></select></label>}
    {(table==='6max'||many)&&depth===100&&<label>レーキ<select value={rake} onChange={e=>{setRake(e.target.value);setId(null);}}><option value="">なし</option>{RAKE_CHARTS.filter(r=>r.menu).map(r=><option key={r.bps} value={`${r.bps}-${r.capBb}`}>{r.label}</option>)}</select></label>}
    <label className={styles.desktopOnly}>状況<select value={kind} onChange={e=>{setKind(e.target.value);setId(null);}}>{KINDS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    <label className={styles.desktopOnly}>立場<select value={node?.id??''} onChange={e=>setId(Number(e.target.value))}>{options.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
   </div>
   {!locked&&<div className={styles.chips}>
    <ChipRow label="状況" value={kind} options={KINDS.filter(([k])=>data.nodes.some(n=>n.kind===k)).map(([k])=>({value:k,label:table==='hu'&&k==='open'?'最初の行動':KIND_SHORT[k]??k}))} onChange={v=>{setKind(v);setId(null);}}/>
    {seats.length>1&&<ChipRow label="自分の席" value={node?.player??''} options={seats.map(p=>({value:p,label:p}))} onChange={p=>setId(options.find(n=>n.player===p)?.id??null)}/>}
    {mine.length>1&&(mine.length<=8?<ChipRow label="相手" value={node?.id??-1} options={mine.map(n=>({value:n.id,label:shortTitle(n.title)}))} onChange={v=>setId(v)}/>:
     <label className={styles.chipSelect}>相手<select value={node?.id??''} onChange={e=>setId(Number(e.target.value))}>{mine.map(n=><option key={n.id} value={n.id}>{shortTitle(n.title)}</option>)}</select></label>)}
   </div>}
   {locked&&<div className={styles.storeInvite}><b>{depth!==100?'大会向けの8〜9人卓の表はプロプランで使えます':'8〜9人卓の表はスタンダードプランで使えます'}</b><span>実際の店と同じ人数の卓で、ポジションごとの正解の打ち方が見られます。</span>{upsell&&<a href="/pricing">プランを見る</a>}</div>}
   {!locked&&node&&<>
    <p className={styles.totals}><b>{node.title}</b>：全体では {node.actions.map((a,i)=>`${a.label} ${pct(totals[i]??0)}`).join('・')}</p>
    
    
   </>}
   <details className={styles.note}><summary>計算の前提</summary><ul>{data.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul><p>{data.iterations.toLocaleString()}回計算・平均の取り逃し {data.averageRegret.toFixed(4)}BB。6人分を厳密に解くのは計算が重すぎるため、上の前提で簡略化しています。フロップ以降の正解は「フロップ戦略」を見てください。</p></details>
  </>}
 </div>
 {data&&node&&!locked&&<div className={styles.splitMain}><StrategyLegend actions={node.actions}/><table className={styles.grid} aria-label="手札ごとの打ち方" data-hide-back-to-top><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),e=node.strategy[l];if(!e)return <td key={j} data-on="none" data-pick={pick===l?'':undefined} onClick={()=>setPick(l)}>{l}</td>;
     let acc=0;const stops=node.actions.map((a,ai)=>{const from=acc;acc+=e[ai]*100;return `${strategyColor(a,node.actions)} ${from}% ${acc}%`;}).join(',');
     return <td key={j} data-on="mix" data-pick={pick===l?'':undefined} onClick={()=>setPick(l)} style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${node.actions.map((a,ai)=>`${a.label} ${pct(e[ai])}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table><HandDetail hand={pick} actions={node.actions} freqs={pick?node.strategy[pick]:null}/></div>}
 </div>
 </div>;
}

'use client';
import {useMemo,useState} from 'react';
import {MADE_NAMES,handEquity,potOdds} from '@/lib/poker/hand-equity';
import {CardGrid,CardSlot,cardsText,parseCards} from './card-picker';
import picker from './card-picker.module.css';
import styles from './equity-calculator.module.css';

/** 勝率計算機 (owner 2026/11/1): hands against each other with an optional board (cards chosen by tapping), and a
 * pot-odds check that can take a hand's equity from the first tab. */
type Target={g:'board';i:number}|{g:'hand';h:number;i:number};
const BOARD_NAMES=['フロップの1枚目','フロップの2枚目','フロップの3枚目','ターン','リバー'];
const pct=(v:number,d=1)=>`${(v*100).toFixed(d)}%`;
const small=(v:number)=>v>0&&v<0.001?'<0.1%':pct(v);
const fmt=(v:number)=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2}).format(v);

export function EquityCalculator(){
 const [tab,setTab]=useState<'equity'|'odds'>('equity');
 const [hands,setHands]=useState<(number|null)[][]>(()=>[parseCards('Ah Kd')!,parseCards('Js Jc')!]);
 const [board,setBoard]=useState<(number|null)[]>([null,null,null,null,null]);
 const [target,setTarget]=useState<Target|null>(null);
 const [pot,setPot]=useState(100),[bet,setBet]=useState(50),[call,setCall]=useState(50),[eqText,setEqText]=useState(''),[from,setFrom]=useState(0);

 const all=[...hands.flat(),...board].filter((c):c is number=>c!==null);
 const cardAt=(t:Target)=>t.g==='board'?board[t.i]:hands[t.h][t.i];
 const set=(t:Target,c:number|null)=>{if(t.g==='board'){const b=board.slice();b[t.i]=c;setBoard(b);return b;}const hs=hands.map(h=>h.slice());hs[t.h][t.i]=c;setHands(hs);return hs;};
 // After a pick, move to the next empty place in the same group (the board, or that hand).
 const pick=(c:number)=>{if(!target)return;set(target,c);
  if(target.g==='board'){const b=board.slice();b[target.i]=c;const e=b.findIndex(x=>x===null);setTarget(e>=0?{g:'board',i:e}:null);}
  else{const other=1-target.i;setTarget(hands[target.h][other]===null?{g:'hand',h:target.h,i:other}:null);}};
 const tap=(t:Target)=>setTarget(cur=>cur&&cur.g===t.g&&cur.i===t.i&&(cur.g==='board'||(t.g==='hand'&&cur.h===t.h))?null:t);
 const isActive=(t:Target)=>!!target&&target.g===t.g&&target.i===t.i&&(t.g==='board'||(target.g==='hand'&&target.h===(t as {h:number}).h));

 const boardCards=board.filter((c):c is number=>c!==null);
 const ready=hands.filter(h=>h[0]!==null&&h[1]!==null) as number[][];
 const boardOk=[0,3,4,5].includes(boardCards.length);
 const run=useMemo(()=>{if(ready.length<2||!boardOk)return null;try{return handEquity(ready,boardCards);}catch{return null;}},[JSON.stringify(ready),JSON.stringify(boardCards),boardOk]);// eslint-disable-line react-hooks/exhaustive-deps
 const readyIdx=hands.map((h,i)=>h[0]!==null&&h[1]!==null?i:-1).filter(i=>i>=0);
 const resultOf=(i:number)=>{const k=readyIdx.indexOf(i);return run&&k>=0?run.hands[k]:null;};

 const eqFromHand=resultOf(from)?.equity??null;
 const equity=eqText!==''?Number(eqText)/100:eqFromHand??0;
 const odds=potOdds(pot,bet,call,equity);
 const okInputs=pot>=0&&bet>=0&&call>0;

 return <div className={styles.calc}>
  <div className={styles.tabs} role="tablist" aria-label="計算の種類">
   <button type="button" role="tab" aria-selected={tab==='equity'} onClick={()=>setTab('equity')}>ハンドの勝率</button>
   <button type="button" role="tab" aria-selected={tab==='odds'} onClick={()=>setTab('odds')}>ポットオッズ</button>
  </div>
  {tab==='equity'&&<div className={styles.cols}>
   <div className={styles.left}>
    <div role="group" aria-label="ボード"><p className={styles.label}>ボード（なし・フロップ・ターン・リバー）</p>
     <div className={picker.slots}>{board.map((c,i)=><CardSlot key={i} card={c} name={`ボードの${i+1}枚目`} active={isActive({g:'board',i})} label={['','','フロップ','ターン','リバー'][i]} onClick={()=>tap({g:'board',i})}/>)}</div>
    </div>
    {target&&<CardGrid title={target.g==='board'?BOARD_NAMES[target.i]:`ハンド${target.h+1}の${target.i+1}枚目`} blocked={new Set(all.filter(c=>c!==cardAt(target)))} onPick={pick} onDone={()=>setTarget(null)} onClear={()=>{set(target,null);}}
     typedPlaceholder={target.g==='board'?'7s 4d 2h':'Ah Kd'} onTyped={cs=>{if(target.g==='board'){if(cs.length<=5)setBoard([...cs,...new Array(5-cs.length).fill(null)]);}else if(cs.length===2){const hs=hands.map(h=>h.slice());hs[target.h]=cs;setHands(hs);}}}/>}
    {!boardOk&&<p className={styles.warn}>ボードは0枚・3枚（フロップ）・4枚（ターン）・5枚（リバー）のどれかにしてください。</p>}
    {hands.map((h,hi)=>{const r=resultOf(hi);return <div key={hi} className={styles.hand} data-n={hi}>
     <div className={styles.handTop}>
      <b>ハンド{hi+1}</b>
      <div className={picker.slots}>{h.map((c,i)=><CardSlot key={i} card={c} name={`ハンド${hi+1}の${i+1}枚目`} active={isActive({g:'hand',h:hi,i})} onClick={()=>tap({g:'hand',h:hi,i})}/>)}</div>
      <div className={styles.big}>{r?<><strong>{pct(r.win)}</strong><span>の勝率</span><small>引き分け {pct(r.tie)}・エクイティ {pct(r.equity)}</small></>:<small>2枚選ぶと計算します</small>}</div>
     </div>
     <div className={styles.bar} aria-hidden="true"><i style={{width:`${(r?.equity??0)*100}%`}}/></div>
     {hands.length>2&&<button type="button" className={styles.remove} onClick={()=>{setHands(hands.filter((_,i)=>i!==hi));setTarget(null);if(from>=hands.length-1)setFrom(0);}}>ハンド{hi+1}を外す</button>}
    </div>;})}
    <div className={styles.row}>
     {hands.length<6&&<button type="button" className={styles.add} onClick={()=>{setHands([...hands,[null,null]]);setTarget({g:'hand',h:hands.length,i:0});}}>ハンドを追加</button>}
     <button type="button" className={styles.add} onClick={()=>{setHands(hands.map(()=>[null,null]));setBoard([null,null,null,null,null]);setTarget({g:'hand',h:0,i:0});}}>全部消す</button>
    </div>
   </div>
   <div className={styles.right}>
    {run?<>
     <p className={styles.summary}>{readyIdx.map((i,k)=>`ハンド${i+1}（${cardsText(hands[i])}）${pct(run.hands[k].equity)}`).join('・')}{boardCards.length?`　ボード ${cardsText(boardCards)}`:'　プリフロップ'}</p>
     <p className={styles.note}>{run.exact?`残りのカードの出方 ${run.samples.toLocaleString()}通りを全部数えた正確な値です。`:`残りのカードを${run.samples.toLocaleString()}回配った近似値です（誤差はおよそ±0.5%）。`}エクイティは引き分けを人数で分けた取り分です。</p>
     <h3 className={styles.h3}>リバーまでにできる役の確率</h3>
     <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>最終的な役</th>{readyIdx.map(i=><th key={i}>ハンド{i+1}</th>)}</tr></thead>
      <tbody>{MADE_NAMES.map((name,m)=><tr key={name}><td>{name}</td>{run.hands.map((x,k)=><td key={k}>{small(x.made[m])}</td>)}</tr>)}</tbody></table></div>
    </>:<p className={styles.note}>2つ以上のハンドを選ぶと、勝率と、リバーまでにできる役の確率が出ます。</p>}
   </div>
  </div>}
  {tab==='odds'&&<div className={styles.cols}>
   <div className={styles.left}>
    <div className={styles.form}>
     <label>ベット前のポット<input type="number" min={0} value={pot} onChange={e=>setPot(Number(e.target.value))}/></label>
     <label>相手のベット<input type="number" min={0} value={bet} onChange={e=>{const v=Number(e.target.value);if(call===bet)setCall(v);setBet(v);}}/></label>
     <label>コールする額<input type="number" min={0} value={call} onChange={e=>setCall(Number(e.target.value))}/></label>
     <label>エクイティ（%）<input type="number" min={0} max={100} step={0.1} value={eqText!==''?eqText:eqFromHand!==null?(eqFromHand*100).toFixed(1):''} placeholder="勝率タブの結果か、手入力" onChange={e=>setEqText(e.target.value)}/></label>
    </div>
    <p className={styles.label}>エクイティを使うハンド</p>
    <div className={styles.row}>{hands.map((_,i)=><button key={i} type="button" className={styles.pill} aria-pressed={from===i&&eqText===''} onClick={()=>{setFrom(i);setEqText('');}}>ハンド{i+1}{resultOf(i)?` ${pct(resultOf(i)!.equity)}`:''}</button>)}</div>
    <p className={styles.note}>単位は何でもかまいません（BBでもチップでも）。コールする額は、相手のベットと同じにしておけば通常のコールです。</p>
   </div>
   <div className={styles.right}>
    {okInputs?<>
     <p className={styles.label}>コールに必要な勝率</p>
     <p className={styles.huge}>{pct(odds.required)}</p>
     <div className={styles.meter} aria-hidden="true"><i style={{width:`${Math.min(1,equity)*100}%`}}/><em style={{left:`${odds.required*100}%`}}/></div>
     <p className={styles.meterKey}><span>エクイティ {pct(equity)}</span><span>必要 {pct(odds.required)}</span></p>
     <p className={styles.verdict} data-ok={equity>=odds.required||undefined}>{equity>=odds.required?`コールが得です。エクイティ ${pct(equity)} が必要な勝率 ${pct(odds.required)} を上回っています。`:`フォールドが得です。エクイティ ${pct(equity)} が必要な勝率 ${pct(odds.required)} に届いていません。`}</p>
     <p className={styles.note}>{fmt(call)}をコールすると最後のポットは{fmt(odds.final)}。そのうち{pct(equity)}を取れる見込みなので、コールの期待値は {odds.ev>=0?'+':''}{fmt(odds.ev)}（フォールドと比べて）です。この計算が正確なのは、リバーや相手のオールインへのコールのように、このあとベットが続かないときです。</p>
    </>:<p className={styles.warn}>コールする額は0より大きく、ポットとベットは0以上にしてください。</p>}
   </div>
  </div>}
 </div>;
}

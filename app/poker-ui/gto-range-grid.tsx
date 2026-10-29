'use client';
import {useEffect} from 'react';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';
import {categoryBreakdown,type GtoRange} from '@/lib/poker/gto-review';

/** The whole range at one reviewed decision (2026/10/29): 13×13 hand classes, each cell split by the action shares,
 * dimmed by how often the player arrives here with that hand. The viewer's own hand is outlined. */
const R='AKQJT98765432';
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const combos=(l:string)=>l.length===2?6:l[2]==='s'?4:12;
const pct=(n:number)=>`${Math.round(n*100)}%`;

export function rangeColors(options:readonly {kind:string;text?:string}[]){
 const actions=options.map(o=>({kind:o.kind,label:o.text??o.kind}));
 return actions.map(a=>strategyColor(a,actions));
}

/** As a dialog over the table (practice table, where the side panel is narrow). */
export function GtoRangeDialog({range,who,title,onClose}:{range:GtoRange;who:string;title:string;onClose:()=>void}){
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 return <div className={styles.overlay} role="presentation" onClick={onClose}>
  <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}>
   <div className={styles.dialogHead}><strong>{title}</strong><button type="button" onClick={onClose}>閉じる</button></div>
   <GtoRangeGrid range={range} who={who}/>
  </div>
 </div>;
}

export function GtoRangeGrid({range,who}:{range:GtoRange;who:string}){
 const colors=rangeColors(range.options),k=range.options.length;
 const totals=new Array(k).fill(0);let all=0;
 for(const [cls,e] of Object.entries(range.grid)){const w=combos(cls)*e.reach;all+=w;for(let a=0;a<k;a++)totals[a]+=w*(e.freqs[a]??0);}
 return <div className={styles.wrap}>
  <p className={styles.note}>{who}のレンジ全体：{range.options.map((o,i)=>`${o.text} ${pct(all>0?totals[i]/all:0)}`).join('・')}{range.nearFlop?`（計算済みの近いフロップ ${range.nearFlop} の答え）`:''}</p>
  <StrategyLegend actions={range.options.map(o=>({kind:o.kind,label:o.text}))}/><table className={styles.grid} aria-label="手札ごとのGTOの打ち方"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{
   const l=label(i,j),e=range.grid[l],mine=l===range.hero;
   if(!e||e.reach<0.005)return <td key={j} data-on="none" data-hero={mine||undefined}>{l}</td>;
   let acc=0;const stops=range.options.map((_,a)=>{const from=acc;acc+=(e.freqs[a]??0)*100;return `${colors[a]} ${from}% ${acc}%`;}).join(',');
   return <td key={j} data-on="mix" data-hero={mine||undefined} style={{background:`linear-gradient(90deg,${stops})`,opacity:0.85+0.15*Math.min(1,e.reach)}}
    title={`${l}：${range.options.map((o,a)=>`${o.text} ${pct(e.freqs[a]??0)}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table>
  <p className={styles.note}>薄いマスはこの場面にあまり来ない手です。金の枠があなたの手です。</p>
  {range.board&&(()=>{const rows=categoryBreakdown(range);return rows.length>0&&<div className={styles.cats} role="table" aria-label="役の強さごとの打ち方">
   <p className={styles.note}>役の強さごとの打ち方（左の数字はレンジの中の割合）</p>
   {rows.map(r=>{let acc=0;const stops=range.options.map((_,a)=>{const from=acc;acc+=r.freqs[a]*100;return `${colors[a]} ${from}% ${acc}%`;}).join(',');
    return <div key={r.category} className={styles.catRow} role="row"><span role="cell">{r.category}</span><small role="cell">{pct(r.share)}</small>
     <i role="cell" style={{background:`linear-gradient(90deg,${stops})`}} title={range.options.map((o,a)=>`${o.text} ${pct(r.freqs[a])}`).join('・')}/></div>;})}
  </div>;})()}
 </div>;
}

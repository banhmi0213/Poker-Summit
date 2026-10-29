'use client';
import styles from './gto-chart.module.css';
import type {GtoRange} from '@/lib/poker/gto-review';

/** The whole range at one reviewed decision (2026/10/29): 13×13 hand classes, each cell split by the action shares,
 * dimmed by how often the player arrives here with that hand. The viewer's own hand is outlined. */
const R='AKQJT98765432';
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const combos=(l:string)=>l.length===2?6:l[2]==='s'?4:12;
const SIZED=['#e6c67f','#d9a058','#d0784f','#b85a3c'];
const pct=(n:number)=>`${Math.round(n*100)}%`;

export function rangeColors(options:readonly {kind:string}[]){
 let sized=0;
 return options.map(o=>o.kind==='fold'?'#5a6b78':o.kind==='check'||o.kind==='call'?'#4f8f74':o.kind==='allin'?'#9e3f46':SIZED[Math.min(SIZED.length-1,sized++)]);
}

export function GtoRangeGrid({range,who}:{range:GtoRange;who:string}){
 const colors=rangeColors(range.options),k=range.options.length;
 const totals=new Array(k).fill(0);let all=0;
 for(const [cls,e] of Object.entries(range.grid)){const w=combos(cls)*e.reach;all+=w;for(let a=0;a<k;a++)totals[a]+=w*(e.freqs[a]??0);}
 return <div className={styles.wrap}>
  <p className={styles.note}>{who}のレンジ全体：{range.options.map((o,i)=>`${o.text} ${pct(all>0?totals[i]/all:0)}`).join('・')}{range.nearFlop?`（計算済みの近いフロップ ${range.nearFlop} の答え）`:''}</p>
  <table className={styles.grid} aria-label="手札ごとのGTOの打ち方"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{
   const l=label(i,j),e=range.grid[l],mine=l===range.hero;
   if(!e||e.reach<0.005)return <td key={j} data-on="none" data-hero={mine||undefined}>{l}</td>;
   let acc=0;const stops=range.options.map((_,a)=>{const from=acc;acc+=(e.freqs[a]??0)*100;return `${colors[a]} ${from}% ${acc}%`;}).join(',');
   return <td key={j} data-on="mix" data-hero={mine||undefined} style={{background:`linear-gradient(90deg,${stops})`,opacity:0.4+0.6*Math.min(1,e.reach)}}
    title={`${l}：${range.options.map((o,a)=>`${o.text} ${pct(e.freqs[a]??0)}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table>
  <p className={styles.legend}>{range.options.map((o,i)=><em key={i} className={styles.key}><i style={{background:colors[i]}}/>{o.text}</em>)} 色の割合＝その手でその打ち方をする割合。薄いマスはこの場面にあまり来ない手、灰色は来ない手。金の枠があなたの手。</p>
 </div>;
}

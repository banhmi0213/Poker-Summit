'use client';
import {strategyColor,type StrategyAction} from './strategy-colors';
import styles from './gto-chart.module.css';

/** The tapped cell of a 13×13 chart (owner 2026/11/1「スマホの部分もっと改善」): phones have no hover, so the shares of
 * one hand are written out under the table with a bar per action. */
const pct=(v:number)=>`${Math.round(v*100)}%`;
export function HandDetail({hand,actions,freqs}:{hand:string|null;actions:readonly StrategyAction[];freqs:readonly number[]|null|undefined}){
 if(!hand)return <p className={styles.handDetailHint}>マスを押すと、その手の割合がここに出ます。</p>;
 if(!freqs)return <div className={styles.handDetail}><b>{hand}</b><span>この場面には来ない手です。</span></div>;
 // One bar split by the shares (the same colours as the table), then each action with its share.
 return <div className={styles.handDetail} aria-live="polite"><b>{hand}</b>
  <div className={styles.shareBar} aria-hidden="true">{actions.map((a,i)=>(freqs[i]??0)>=0.005&&<span key={i} style={{flexGrow:freqs[i],background:strategyColor(a,actions)}}>{(freqs[i]??0)>=0.12?pct(freqs[i]):''}</span>)}</div>
  <ul>{actions.map((a,i)=><li key={i} data-zero={(freqs[i]??0)<0.005?'':undefined}><i style={{background:strategyColor(a,actions)}} aria-hidden="true"/><span>{a.label}</span><strong>{pct(freqs[i]??0)}</strong></li>)}</ul></div>;
}

/** A row of buttons in place of a select on phones (seats, situations). */
export function ChipRow<T extends string|number>({label,value,options,onChange}:{label:string;value:T;options:readonly {value:T;label:string}[];onChange:(v:T)=>void}){
 return <div className={styles.chipRow} role="group" aria-label={label}><span>{label}</span><div>{options.map(o=><button key={String(o.value)} type="button" aria-pressed={o.value===value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</div></div>;
}

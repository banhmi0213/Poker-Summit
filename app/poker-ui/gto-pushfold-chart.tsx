'use client';
import {useState} from 'react';
import data from '@/data/poker-gto/hu-pushfold.json';
import styles from './gto-chart.module.css';

const R='AKQJT98765432';
type Spot={push:Record<string,number>;call:Record<string,number>;pushPct:number;callPct:number;exploit:number};
const spots=data.spots as unknown as Record<string,Spot>;
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
/** 13x13 starting-hand grid: suited above the diagonal, offsuit below, pairs on it. */
function Grid({freq,caption}:{freq:Record<string,number>;caption:string}){
 return <table className={styles.grid} aria-label={caption}><caption>{caption}</caption><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),f=freq[l]??0;
  return <td key={j} data-on={f>=0.99?'all':f>=0.01?'mix':'fold'} style={f>=0.01&&f<0.99?{background:`linear-gradient(90deg,var(--gto-on) ${Math.round(f*100)}%,var(--gto-fold) ${Math.round(f*100)}%)`}:undefined} title={`${l}：${Math.round(f*100)}%`}>{l}</td>;})}</tr>)}</tbody></table>;
}
export function PushFoldChart(){
 const stacks=data.stacks.map(String);
 const [stack,setStack]=useState('10');
 const s=spots[stack];
 return <div className={styles.wrap}>
  <p>2人卓で、お互いのチップが少ないとき（25BB以下）に「オールインかフォールドだけ」で戦う場合の正解（ナッシュ均衡）です。SB（ボタン）はオールインするか降りるか、BBはそのオールインにコールするか降りるかを選びます。</p>
  <label className={styles.stack}>持っているチップ（少ない方）<select value={stack} onChange={e=>setStack(e.target.value)}>{stacks.map(v=><option key={v} value={v}>{v}BB</option>)}</select></label>
  <div className={styles.pair}>
   <Grid freq={s.push} caption={`SB：オールインする手（全体の${s.pushPct}%）`}/>
   <Grid freq={s.call} caption={`BB：コールする手（全体の${s.callPct}%）`}/>
  </div>
  <p className={styles.legend}>表の T は 10 のことです。 <span data-on="all"/>いつも <span data-on="mix"/>ときどき（色の割合） <span data-on="none"/>降りる</p>
  <p className={styles.note}>※アンティなし・SB 0.5BB／BB 1BBで計算。169種類のスタートハンド同士の勝率（1組2万回）から求めた均衡で、正解からのズレは1ハンドあたり{s.exploit}BB未満です。20BBを超えると、オールイン以外（小さめのレイズ）も混ぜる方が得になる場面が増えます。</p>
 </div>;
}

'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {LobbyIcon} from './lobby-icon';
import styles from './lobby-dashboard.module.css';
type Row={place:number;displayName:string;avatarUrl:string|null;gain:number;you:boolean};
/** 「◯月 チップ獲得ランキング」: this month's ring gains, positive only (owner 2026/10/31). */
export function useMonthlyRanking(limit:number){
 const [data,setData]=useState<{month:string;rows:Row[]}|null|'error'>(null);
 useEffect(()=>{let live=true;createClient().rpc('poker_ring_monthly_ranking',{p_limit:limit}).then(({data:d,error})=>{if(!live)return;
  const v=d as {month?:unknown;rows?:unknown}|null;
  if(error||!v||typeof v.month!=='string'||!Array.isArray(v.rows)){setData('error');return;}
  setData({month:v.month,rows:(v.rows as Row[]).filter(r=>Number.isSafeInteger(r?.place)&&typeof r.displayName==='string'&&Number.isSafeInteger(r.gain)&&r.gain>0)});});
  return()=>{live=false;};},[limit]);
 return data;
}
export const monthLabel=(m?:string)=>{const n=m?Number(m.slice(5)):new Date(Date.now()+9*3600000).getUTCMonth()+1;return `${n}月`;};
export function MonthlyRanking({limit,expanded=false}:{limit:number;expanded?:boolean}){
 const data=useMonthlyRanking(limit);
 const rows=data&&data!=='error'?data.rows:[];
 return <div className={styles.recordPlaceholder}>
  <div className={styles.recordSkeleton}>{(rows.length?rows:[1,2,3].slice(0,expanded?3:3).map(()=>null)).map((r,i)=>r?<div key={i} aria-current={r.you||undefined}>
   <span className={styles.medal} data-place={Math.min(r.place,3)}>{r.place}</span>
   {r.avatarUrl?<img src={r.avatarUrl} alt="" width="32" height="32" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}}/>:<span className={styles.avatarGhost}/>}
   <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:700}}>{r.displayName}{r.you?'（あなた）':''}</span>
   <span style={{fontWeight:800,color:'#ffd987',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>+{r.gain.toLocaleString()}</span>
  </div>:<div key={i} aria-hidden="true"><span className={styles.medal} data-place={i+1}>{i+1}</span><span className={styles.avatarGhost}/><span className={styles.nameGhost}/><span className={styles.valueGhost}/></div>)}</div>
  <p>{data===null?'読み込み中です。':data==='error'?'ランキングを読み込めませんでした。':rows.length?`${monthLabel(data.month)}にリングで獲得したチップの多い順です（プラスの人だけ）。`:'今月はまだ、チップを増やした人がいません。'}</p>
  {expanded&&<p className={styles.lead}>毎月1日0時（日本時間）にチップは1,000にリセットされ、ランキングも新しい月から数え直します。</p>}
 </div>;
}
export function MonthlyRankingHeading(){return <h2><LobbyIcon name="chart"/>{monthLabel()} チップ獲得ランキング</h2>;}

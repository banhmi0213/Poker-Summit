"use client";
// レート別の成績(オーナー 2026/11/04)：全体とリングの各レートを切り替えて見る。レートは公開中のテーブルから自動で増える。
import {useState} from 'react';
import {HandStatsView} from './hand-stats-view';
import type {HandStatsSummary,StakeStats} from '@/lib/poker/hand-histories';
import tabs from './gto-weak-spots.module.css';

export function HandStatsByStake({all,stakes}:{all:HandStatsSummary;stakes:StakeStats[]}){
 const [bb,setBb]=useState<number|null>(null);
 const chosen=bb===null?null:stakes.find(s=>s.bb===bb)??null;
 return <>
  {stakes.length>0&&<div className={tabs.tabs} style={{marginBottom:12}} role="group" aria-label="レート">
   <button type="button" aria-pressed={chosen===null} onClick={()=>setBb(null)}>全体</button>
   {stakes.map(s=><button key={s.bb} type="button" aria-pressed={chosen?.bb===s.bb} onClick={()=>setBb(s.bb)}>{`${s.sb}/${s.bb}`}</button>)}
  </div>}
  <HandStatsView key={chosen?.bb??'all'} stats={chosen?.stats??all}/>
 </>;
}

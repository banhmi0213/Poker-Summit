'use client';
import {useRef,useState} from 'react';
import styles from './hand-history.module.css';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import type {HandFlags} from '@/lib/poker/gto-review';
import {flagHands} from './hand-history-gto';
import {handDate} from './hand-history-list';

/** 「GTOから外れた率」(2026/10/29) and セッションレビュー (2026/10/30, Olympia に合わせて): the member's recent ring hands
 * judged against GTO in the worker — preflop and flop at once, then turn and river hand by hand. Off = a decision GTO
 * makes under 5% of the time with that hand. Sessions = hands with less than 30 minutes between them. */
const STREET:Record<string,string>={preflop:'プリフロップ',flop:'フロップ',turn:'ターン',river:'リバー'};
const GAP=30*60*1000;
type Session={start:string;end:string;hands:HandHistoryView[]};
function sessionsOf(hands:HandHistoryView[]):Session[]{
 const sorted=[...hands].sort((a,b)=>Date.parse(a.playedAt)-Date.parse(b.playedAt)),out:Session[]=[];
 for(const h of sorted){const last=out[out.length-1];
  if(last&&Date.parse(h.playedAt)-Date.parse(last.end)<GAP){last.hands.push(h);last.end=h.playedAt;}else out.push({start:h.playedAt,end:h.playedAt,hands:[h]});}
 return out.reverse();
}
const pct=(off:number,judged:number)=>judged?`${Math.round(off*1000/judged)/10}%`:'—';
function totals(hands:HandHistoryView[],flags:Record<string,HandFlags>){
 let pj=0,po=0,qj=0,qo=0,net=0;const offs:(HandFlags['offs'][number]&{handId:string})[]=[];
 for(const h of hands){const me=h.players.find(p=>p.you);if(me)net+=me.net/h.terms.bb;const f=flags[h.handId];if(!f)continue;
  pj+=f.pre.judged;po+=f.pre.off;qj+=f.post.judged;qo+=f.post.off;offs.push(...f.offs.map(o=>({...o,handId:h.handId})));}
 return {pj,po,qj,qo,net:Math.round(net*10)/10,offs:offs.sort((a,b)=>a.freq-b.freq)};
}
export function GtoDeviationView(){
 const [hands,setHands]=useState<HandHistoryView[]|null>(null),[flags,setFlags]=useState<Record<string,HandFlags>|null>(null);
 const [progress,setProgress]=useState<[number,number]|null>(null),[status,setStatus]=useState<'idle'|'running'|'error'|'done'>('idle'),[open,setOpen]=useState<number|null>(0);
 const run=useRef(0);
 const start=async()=>{
  const me=++run.current;setStatus('running');setFlags(null);
  try{const res=await fetch('/api/poker/recent-hands',{cache:'no-store'});if(!res.ok)throw Error();const hs=(await res.json()).hands as HandHistoryView[];setHands(hs);
   await flagHands(hs,(f,done,total)=>{if(run.current!==me)return;setFlags(f);setProgress(done<total?[done,total]:null);},()=>run.current===me);
   if(run.current===me)setStatus('done');
  }catch{if(run.current===me)setStatus('error');}
 };
 const all=hands&&flags?totals(hands,flags):null;
 return <div className={styles.replay}>
  <div className={styles.head}><strong>GTOから外れた率・セッションレビュー</strong><span>直近 {hands?.length??100}ハンドまで（リング）</span></div>
  <p>自分の判断をプリフロップからリバーまでGTOと比べます。GTOならその手で5%未満しか選ばない打ち方を「外れた」と数えます。30分以上あいたら別のセッションです。</p>
  {status==='idle'&&<div className={styles.gtoBar}><button type="button" onClick={start}>GTOと比べる</button></div>}
  {status==='error'&&<div className={styles.gtoBar}><span role="alert">計算に失敗しました。</span><button type="button" onClick={start}>もう一度</button></div>}
  {(status==='running'||status==='done')&&!all&&<p role="status">計算中…</p>}
  {all&&<>
   {progress&&<p role="status">ターン・リバーを判定中 {progress[0]}/{progress[1]}（数字は判定が進むと増えます）</p>}
   <div className={styles.stats}>
    <div className={styles.stat}><small>プリフロップ</small><b>{pct(all.po,all.pj)}</b><span>{all.po} / {all.pj}回</span></div>
    <div className={styles.stat}><small>フロップ以降</small><b>{pct(all.qo,all.qj)}</b><span>{all.qo} / {all.qj}回</span></div>
   </div>
   {all.pj+all.qj<30&&<p>まだ判断の数が少ないため、数字は大きくぶれます。</p>}
   <p className={styles.street}>セッション別</p>
   <ul className={styles.log}>{sessionsOf(hands!).map((s,i)=>{const t=totals(s.hands,flags!);return <li key={s.start}>
    <em>{handDate(s.start)}</em>
    <span><button type="button" className={styles.gtoBadge} aria-expanded={open===i} onClick={()=>setOpen(open===i?null:i)}>{open===i?'閉じる':'外れた打ち方'}</button>
     {s.hands.length}ハンド・収支 {t.net>0?'+':''}{t.net}BB・プリフロップ {pct(t.po,t.pj)}（{t.po}/{t.pj}）・フロップ以降 {pct(t.qo,t.qj)}（{t.qo}/{t.qj}）
     {open===i&&(t.offs.length?<ul className={styles.log}>{t.offs.map((o,k)=><li key={k}><em>{STREET[o.street]}</em><span><a href={`/mypage/poker/hands/${o.handId}`}>{o.played}</a>（GTOでは {Math.round(o.freq*1000)/10}%・いちばん多いのは {o.best}）</span></li>)}</ul>:<p>このセッションで外れた打ち方はありません。</p>)}
    </span></li>;})}</ul>
   <p>※3人以上のポット（計算していない形）・スタックが浅すぎる／深すぎるハンド・表にない進行は数えていません。</p>
  </>}
 </div>;
}

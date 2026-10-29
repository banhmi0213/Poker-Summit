'use client';
import {useRef,useState} from 'react';
import styles from './hand-history.module.css';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import type {DeviationStreet,DeviationSummary} from '@/lib/poker/gto-review';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';

/** 「GTOから外れた率」(2026/10/29): the member's recent ring hands judged against the preflop chart and the flop data,
 * in the GTO worker. Off = a decision GTO makes under 5% of the time. */
const rate=(s:DeviationStreet)=>s.judged?`${Math.round(s.rare*1000/s.judged)/10}%`:'—';
export function GtoDeviationView(){
 const [count,setCount]=useState<number|null>(null);
 const [state,setState]=useState<{status:'idle'|'running'|'error'}|{status:'done';summary:DeviationSummary}>({status:'idle'});
 const worker=useRef<Worker|null>(null);
 const start=async()=>{
  setState({status:'running'});
  try{const res=await fetch('/api/poker/recent-hands',{cache:'no-store'});if(!res.ok)throw Error();const hands=(await res.json()).hands as HandHistoryView[];setCount(hands.length);
   if(!hands.length){setState({status:'done',summary:{hands:0,preflop:{judged:0,gto:0,mixed:0,rare:0},flop:{judged:0,gto:0,mixed:0,rare:0},worst:[]}});return;}
   const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');worker.current?.terminate();const w=createGtoWorker();worker.current=w;
   const guard=window.setTimeout(()=>{w.terminate();setState({status:'error'});},60000);
   w.onmessage=(e:MessageEvent<GtoReply>)=>{window.clearTimeout(guard);w.terminate();worker.current=null;setState(e.data.type==='deviation'?{status:'done',summary:e.data.summary}:{status:'error'});};
   w.onerror=()=>{window.clearTimeout(guard);setState({status:'error'});};
   w.postMessage({type:'deviation',id:1,hands:hands.map(h=>({handId:h.handId,terms:h.terms,buttonSeatId:h.buttonSeatId,board:h.board,actions:h.actions,
    players:h.players.map(p=>({seatId:p.seatId,seat:p.seat,startStack:p.startStack,you:p.you,hole:p.you?p.hole:null}))}))} satisfies GtoRequest);
  }catch{setState({status:'error'});}
 };
 return <div className={styles.replay}>
  <div className={styles.head}><strong>GTOから外れた率</strong><span>直近 {count??100}ハンドまで（リング）</span></div>
  <p>プリフロップとフロップの自分の判断を、GTOの計算結果と比べます。GTOなら5%未満しか選ばない打ち方を「外れた」と数えます。</p>
  {state.status==='idle'&&<div className={styles.gtoBar}><button type="button" onClick={start}>GTOと比べる</button></div>}
  {state.status==='running'&&<p role="status">計算中…</p>}
  {state.status==='error'&&<div className={styles.gtoBar}><span role="alert">計算に失敗しました。</span><button type="button" onClick={start}>もう一度</button></div>}
  {state.status==='done'&&(()=>{const s=state.summary;return <>
   <div className={styles.stats}>{([['プリフロップ',s.preflop],['フロップ',s.flop]] as const).map(([label,st])=><div key={label} className={styles.stat}>
    <small>{label}</small><b>{rate(st)}</b><span>{st.rare.toLocaleString()} / {st.judged.toLocaleString()}回</span>
    <p>GTO通り {st.gto}・ときどき {st.mixed}・ほぼやらない {st.rare}</p></div>)}</div>
   {s.preflop.judged+s.flop.judged<30&&<p>まだ判断の数が少ないため、数字は大きくぶれます。</p>}
   {s.worst.length>0&&<><p className={styles.street}>大きく外れた判断</p><ul className={styles.log}>{s.worst.map((w,i)=><li key={i}><em>{w.street==='preflop'?'プリフロップ':'フロップ'}</em><span><a href={`/mypage/poker/hands/${w.handId}`}>{w.played}</a>（GTOでは {Math.round(w.freq*1000)/10}%・いちばん多いのは {w.best}）</span></li>)}</ul></>}
   <p>※3人以上のポット・スタックが浅すぎる／深すぎるハンド・表にない進行は数えていません。ターンとリバーはハンドごとの「GTOで振り返る」で確認できます。</p>
  </>;})()}
 </div>;
}

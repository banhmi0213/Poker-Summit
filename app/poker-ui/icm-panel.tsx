'use client';
import {useEffect,useRef,useState} from 'react';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';
import type {IcmResult} from '@/lib/poker/icm';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';

/** ICM push/fold calculator (2026/10/30): stacks, ante and prizes in, all-in / call ranges with prizes (ICM) and with
 * chips only out, so the tightening near the money is visible. Solved in the GTO worker (icm.ts). */
const R='AKQJT98765432';
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const SEATS:Record<number,string[]>={2:['SB','BB'],3:['BTN','SB','BB'],4:['CO','BTN','SB','BB'],5:['HJ','CO','BTN','SB','BB'],6:['UTG','HJ','CO','BTN','SB','BB'],
 7:['UTG','LJ','HJ','CO','BTN','SB','BB'],8:['UTG','UTG+1','LJ','HJ','CO','BTN','SB','BB'],9:['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB']};
const nums=(t:string)=>t.split(/[,、\s]+/).map(Number).filter(x=>Number.isFinite(x)&&x>0);
type Results={icm:IcmResult;chip:IcmResult};

export function IcmPanel(){
 const [count,setCount]=useState(6),[stacks,setStacks]=useState<string[]>(['15','25','8','12','20','10']);
 const [ante,setAnte]=useState('1'),[payouts,setPayouts]=useState('50,30,20'),[others,setOthers]=useState('');
 const [res,setRes]=useState<Results|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [who,setWho]=useState(0),[vs,setVs]=useState(-1);
 const worker=useRef<Worker|null>(null),seq=useRef(0);
 useEffect(()=>()=>worker.current?.terminate(),[]);
 const seats=SEATS[count];
 const setN=(n:number)=>{setCount(n);setStacks(s=>Array.from({length:n},(_,i)=>s[i]??'15'));setRes(null);setWho(0);setVs(-1);};
 const run=async()=>{
  const st=stacks.map(Number);if(st.some(x=>!(x>0)))return setError('スタックは0より大きいBBの数で入れてください。');
  const pay=nums(payouts);if(!pay.length)return setError('賞金を「50,30,20」のように入れてください（金額でも割合でも大丈夫です）。');
  setError('');setBusy(true);
  try{
   if(!worker.current){const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');worker.current=createGtoWorker();}
   const w=worker.current!,id=++seq.current;
   const reply=await new Promise<GtoReply>(resolve=>{const on=(e:MessageEvent<GtoReply>)=>{if(e.data.id!==id)return;w.removeEventListener('message',on);resolve(e.data);};w.addEventListener('message',on);
    w.postMessage({type:'icm',id,spot:{players:seats.map((pos,i)=>({pos,stack:st[i]})),ante:Number(ante)||0,payouts:pay,others:nums(others)}} satisfies GtoRequest);});
   if(reply.type==='icm')setRes(reply.result);else setError(reply.type==='error'?reply.message:'計算できませんでした。');
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 };
 const grid=res?(vs<0?res.icm.jam[who]:res.icm.call[vs]?.[who]):null;
 const actions=vs<0?[{kind:'fold',label:'フォールド'},{kind:'allin',label:'オールイン'}]:[{kind:'fold',label:'フォールド'},{kind:'call',label:'コール'}];
 const idx=res?new Map(res.icm.labels.map((l,i)=>[l,i])):null;
 return <div className={styles.wrap}>
  <p>大会の終盤（スタックが浅いとき）に、オールインするか・オールインにコールするかを、賞金の取り分（ICM）で計算します。チップの量だけで考えた答えと並べるので、入賞ライン前後でどれだけ慎重になるかが分かります。</p>
  <div className={styles.form}>
   <label>人数<select value={count} onChange={e=>setN(Number(e.target.value))}>{[2,3,4,5,6,7,8,9].map(n=><option key={n} value={n}>{n}人</option>)}</select></label>
   <label>アンティ（BB）<input inputMode="decimal" value={ante} onChange={e=>setAnte(e.target.value)}/></label>
   <label>賞金（上から順に）<input value={payouts} onChange={e=>setPayouts(e.target.value)} placeholder="50,30,20"/></label>
   <label>ほかの卓の人のスタック（BB、任意）<input value={others} onChange={e=>setOthers(e.target.value)} placeholder="例：30,12,45"/></label>
  </div>
  <div className={styles.form}>{seats.map((pos,i)=><label key={pos}>{pos}のスタック（BB）<input inputMode="decimal" value={stacks[i]} onChange={e=>setStacks(s=>s.map((x,j)=>j===i?e.target.value:x))}/></label>)}</div>
  <div className={styles.form}><button type="button" onClick={run} disabled={busy}>計算する</button></div>
  <p className={styles.note}>前提：アクションは先頭から順番に、最初の人はオールインかフォールド。オールインが入ったら後ろの人はコールかフォールドで、最初にコールした人と1対1の勝負になります。SBは0.5BB、BBは1BBとアンティを払います。</p>
  {busy&&<p role="status">計算中…（数秒かかります）</p>}
  {error&&<p role="alert">{error}</p>}
  {res&&!busy&&<>
   <table className={styles.grid} aria-label="立場ごとのオールイン率"><tbody>
    <tr>{['立場','スタック','賞金の取り分','オールイン（ICM）','オールイン（チップだけ）'].map(h=><td key={h}>{h}</td>)}</tr>
    {seats.map((pos,i)=><tr key={pos}><td>{pos}</td><td>{stacks[i]}BB</td><td>{(res.icm.equityBefore[i]/(nums(payouts).reduce((a,b)=>a+b,0)||1)*100).toFixed(1)}%</td>
     <td>{pos==='BB'?'-':`${res.icm.jamPct[i]}%`}</td><td>{pos==='BB'?'-':`${res.chip.jamPct[i]}%`}</td></tr>)}
   </tbody></table>
   <div className={styles.form}>
    <label>場面<select value={vs} onChange={e=>{const v=Number(e.target.value);setVs(v);setWho(v<0?0:v+1);}}><option value={-1}>誰も参加していない（オールインするか）</option>{seats.slice(0,-1).map((pos,k)=><option key={pos} value={k}>{pos}のオールインにコールするか</option>)}</select></label>
    <label>立場<select value={who} onChange={e=>setWho(Number(e.target.value))}>{seats.map((pos,i)=>vs<0?(pos==='BB'?null:<option key={pos} value={i}>{pos}</option>):(i>vs?<option key={pos} value={i}>{pos}</option>:null))}</select></label>
   </div>
   {grid&&idx&&<>
    <p><b>{seats[who]}</b>：{vs<0?'オールイン':'コール'} ICM {vs<0?res.icm.jamPct[who]:res.icm.callPct[vs]?.[who]}%（チップだけなら {vs<0?res.chip.jamPct[who]:res.chip.callPct[vs]?.[who]}%）</p>
    <StrategyLegend actions={actions}/><table className={styles.grid} aria-label="手札ごとのオールイン・コール"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),f=grid[idx.get(l)!]??0;
     const stops=`${strategyColor(actions[0],actions)} 0% ${(1-f)*100}%,${strategyColor(actions[1],actions)} ${(1-f)*100}% 100%`;
     return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${actions[1].label} ${Math.round(f*100)}%`}>{l}</td>;})}</tr>)}</tbody></table>
   </>}
  </>}
 </div>;
}

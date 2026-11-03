'use client';
import {useEffect,useRef,useState} from 'react';
import type {GtoReply,GtoRequest} from '@/lib/poker/gto.worker';
import type {ExploreResult} from '@/lib/poker/gto-explore';
import type {FlopData} from '@/lib/poker/gto-spots';
import styles from './gto-chart.module.css';
import {strategyColor} from './strategy-colors';
import {StrategyLegend} from './strategy-legend';

/** Turn and river after a flop line (2026/10/30): pick the turn card, the worker solves the turn and river in a few
 * seconds (gto-explore.ts), then walk the actions and river cards like the flop table. */
const R='AKQJT98765432',RANKS='23456789TJQKA',SUITS='cdhs',SUIT:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
const label=(i:number,j:number)=>i===j?R[i]+R[j]:i<j?R[i]+R[j]+'s':R[j]+R[i]+'o';
const cardName=(c:number)=>RANKS[c>>2]+SUIT[SUITS[c&3]];
const cardCode=(c:number)=>RANKS[c>>2]+SUITS[c&3];
const pct=(v:number)=>`${Math.round(v*100)}%`;

export function TurnExplorer({spot,data,path,lineText}:{spot:string;data:FlopData;path:number[];lineText:string}){
 const seats=[data.spot.oop??'',data.spot.ip??''];
 const free=[...Array(52).keys()].filter(c=>!data.board.includes(c)).sort((a,b)=>b-a);
 const [turn,setTurn]=useState<number>(free[0]),[steps,setSteps]=useState<number[]|null>(null),[river,setRiver]=useState<number|null>(null);
 const [result,setResult]=useState<ExploreResult|null>(null),[busy,setBusy]=useState(false);
 const worker=useRef<Worker|null>(null),seq=useRef(0);
 useEffect(()=>()=>worker.current?.terminate(),[]);
 // A new flop line starts over.
 useEffect(()=>{setSteps(null);setResult(null);},[spot,data.flop,path.join('.')]);
 useEffect(()=>{
  if(steps===null)return;let live=true;const id=++seq.current;setBusy(true);
  void (async()=>{
   try{
    if(!worker.current){const {createGtoWorker}=await import('@/app/poker-demo/gto-worker-client');worker.current=createGtoWorker();}
    const w=worker.current!;
    const reply=await new Promise<GtoReply>(resolve=>{const on=(e:MessageEvent<GtoReply>)=>{if(e.data.id!==id)return;w.removeEventListener('message',on);resolve(e.data);};w.addEventListener('message',on);
     w.postMessage({type:'explore',id,spot,flop:data.flop,path,turn:cardCode(turn),steps,budgetMs:6000} satisfies GtoRequest);});
    if(!live)return;setResult(reply.type==='explore'?reply.result:{error:reply.type==='error'?reply.message:'計算できませんでした。'});
   }catch(error){if(live)setResult({error:error instanceof Error?error.message:String(error)});}
   finally{if(live)setBusy(false);}
  })();
  return ()=>{live=false;};
 },[steps,turn,spot,data.flop,path]);
 const view=result&&'view' in result?result.view:null;
 const who=(p:number)=>`${seats[p]}（${p===0?'先に打つ人':'後に打つ人'}）`;
 return <div className={styles.wrap}>
  <p><b>ターン・リバーを計算する</b>：{lineText}</p>
  <div className={styles.form}>
   <label>ターンのカード<select value={turn} onChange={e=>{setTurn(Number(e.target.value));setSteps(null);setResult(null);}}>{free.map(c=><option key={c} value={c}>{cardName(c)}</option>)}</select></label>
   <button type="button" onClick={()=>setSteps([])} disabled={busy}>このターンで計算する</button>
  </div>
  <p className={styles.note}>選んだターンとリバーをこの場で計算します（数秒かかります）。レンジはプリフロップの表とフロップの打ち方から絞り込んだもの、ベット額はフロップと同じ前提です。</p>
  {busy&&<p role="status">計算中…</p>}
  {result&&'error' in result&&<p role="alert">{result.error}</p>}
  {view&&!busy&&result&&'spot' in result&&<>
   <p className={styles.note}>ボード {result.spot.board.map(cardName).join(' ')} ・ ポット{Math.round(result.spot.pot*10)/10}BB ・ {result.iterations}回計算</p>
   <nav className={styles.path} aria-label="ターン以降の場面を選ぶ">
    <button type="button" onClick={()=>setSteps([])} disabled={!steps?.length}>ターンの最初から</button>
    {!!steps?.length&&<button type="button" onClick={()=>setSteps(s=>s!.slice(0,-1))}>1つ戻る</button>}
    {view.trail.map((t,i)=><span key={i}>{t.replace(/^OOP/,seats[0]).replace(/^IP/,seats[1])}</span>)}
   </nav>
   {view.kind==='end'&&<p>この流れでハンドは終わりです。</p>}
   {view.kind==='chance'&&<div className={styles.form}>
    <label>リバーのカード<select value={river??view.cards![0]} onChange={e=>setRiver(Number(e.target.value))}>{[...view.cards!].sort((a,b)=>b-a).map(c=><option key={c} value={c}>{cardName(c)}</option>)}</select></label>
    <button type="button" onClick={()=>setSteps(s=>[...s!,river??view.cards![0]])}>このリバーを見る</button>
   </div>}
   {view.kind==='act'&&view.actions&&view.classes&&<>
    <p><b>{who(view.player!)}の番</b>（{view.street==='turn'?'ターン':'リバー'}）：全体では {view.actions.map((a,i)=>`${a.label} ${pct(view.total![i])}`).join('・')}</p>
    <div className={styles.path}>{view.actions.map((a,i)=>a.next?<button key={i} type="button" onClick={()=>{setRiver(null);setSteps(s=>[...s!,i]);}}>「{a.label}」の後を見る</button>:null)}</div>
    <StrategyLegend actions={view.actions}/><table className={styles.grid} aria-label="手札ごとの打ち方（ターン・リバー）"><tbody>{[...R].map((_,i)=><tr key={i}>{[...R].map((_,j)=>{const l=label(i,j),e=view.classes![l];if(!e||e[0]<=0)return <td key={j} data-on="none">{l}</td>;
     let acc=0;const stops=view.actions!.map((a,ai)=>{const from=acc;acc+=e[ai+1]*100;return `${strategyColor(a,view.actions!)} ${from}% ${acc}%`;}).join(',');
     return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${view.actions!.map((a,ai)=>`${a.label} ${pct(e[ai+1])}`).join('・')}`}>{l}</td>;})}</tr>)}</tbody></table>
   </>}
  </>}
 </div>;
}

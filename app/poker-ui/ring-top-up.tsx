'use client';
// チップの追加(オーナー 2026/11/04)：座ったまま持ち点を足す。ハンド中は次のハンドから。上限はテーブルの最大持ち込み額。
// 「自動で最大まで戻す」をオンにすると、ハンドが終わるたびに最大持ち込み額まで足す(持ちチップの範囲で)。
import {useCallback,useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import styles from './table-game-menu.module.css';

type TopUpView={reservationId:string;stack:number;pending:number|null;auto:boolean;maxBuyIn:number;available:number;inHand:boolean};
const parse=(v:unknown):TopUpView|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;const n=(x:unknown)=>typeof x==='number'?x:Number(x);
 if(typeof r.reservationId!=='string')return null;return {reservationId:r.reservationId,stack:n(r.stack)||0,pending:r.pending==null?null:n(r.pending),auto:r.auto===true,maxBuyIn:n(r.maxBuyIn)||0,available:n(r.available)||0,inHand:r.inHand===true};};
const message=(e:{message?:string;hint?:string}|null)=>e?.hint||(/Insufficient/.test(e?.message??'')?'持ちチップが足りません。':/max buy-in/i.test(e?.message??'')?'最大持ち込み額までしか足せません。':'追加できませんでした。時間をおいてもう一度お試しください。');

export function RingTopUp({reservationId,stack}:{reservationId:string;stack:number}){
 const auth=useMemo(()=>createClient(),[]);
 const [view,setView]=useState<TopUpView|null>(null),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 const load=useCallback(async()=>{try{const {data,error}=await auth.rpc('poker_ring_topup_status');if(!error){const v=parse(data);if(v&&v.reservationId===reservationId)setView(v);}}catch{}},[auth,reservationId]);
 useEffect(()=>{void load();},[load,stack]);
 const room=view?Math.max(0,view.maxBuyIn-view.stack):0,limit=view?Math.min(room,view.available):0;
 useEffect(()=>{if(view)setAmount(a=>a===''||Number(a)>limit?String(limit):a);},[view,limit]);
 const send=async(p_amount:number|null,p_auto:boolean|null)=>{setBusy(true);setNote('');try{const {data,error}=await auth.rpc('poker_ring_topup',{p_reservation:reservationId,p_amount,p_auto});if(error){setNote(message(error));return;}const v=parse(data);if(v){setView(v);if(p_amount)setNote(v.pending?`次のハンドから ${v.pending.toLocaleString()} chip 足します。`:`${p_amount.toLocaleString()} chip 足しました。`);}}catch{setNote('追加できませんでした。時間をおいてもう一度お試しください。');}finally{setBusy(false);}};
 if(!view)return <p>読み込み中です。</p>;
 const value=Number(amount),valid=Number.isSafeInteger(value)&&value>=1&&value<=limit;
 return <>
  <h3>チップを追加</h3>
  <p>今の持ち点 {view.stack.toLocaleString()} chip ／ 最大 {view.maxBuyIn.toLocaleString()} chip</p>
  <p>持ちチップ {view.available.toLocaleString()} chip</p>
  {view.pending?<p role="status">次のハンドから {view.pending.toLocaleString()} chip 足します。</p>:null}
  {limit>0?<><label>足す額<input type="number" inputMode="numeric" aria-label="足す額" min={1} max={limit} step={1} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <button type="button" className={styles.primary} disabled={busy||!valid} onClick={()=>void send(value,null)}>{view.inHand?'次のハンドから足す':'チップを追加'}</button></>
  :<p>{room===0?'最大持ち込み額まで入っています。':'持ちチップがありません。'}</p>}
  <label>自動で最大まで戻す<input type="checkbox" aria-label="自動で最大まで戻す" checked={view.auto} disabled={busy} onChange={e=>void send(null,e.target.checked)}/></label>
  {note&&<p role="status">{note}</p>}
 </>;
}

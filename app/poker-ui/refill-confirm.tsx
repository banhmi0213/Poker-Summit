'use client';
// 「補充しますか？」(owner 2026/11/01): the once-a-day refill is always confirmed first, with the amount it brings.
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {parseRingRank} from '@/lib/poker/ring-rank';

export function RefillConfirm({open,lead,onYes,onNo}:{open:boolean;lead?:string;onYes:()=>void;onNo:()=>void}){
 const auth=useMemo(()=>createClient(),[]);
 const [amount,setAmount]=useState<number|null>(null),[used,setUsed]=useState(false);
 useEffect(()=>{if(!open)return;let live=true;
  try{void Promise.resolve(auth.rpc('poker_ring_rank')).then(({data,error})=>{if(!live||error)return;const r=parseRingRank(data);if(r){setAmount(r.refillAmount);setUsed(r.refillUsedToday);}},()=>{});}catch{}
  return()=>{live=false;};},[auth,open]);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onNo();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open,onNo]);
 if(!open)return null;
 return <div role="presentation" style={{position:'fixed',inset:0,zIndex:300,background:'#06121ce6',display:'flex',alignItems:'center',justifyContent:'center',padding:18}}>
  <section role="dialog" aria-modal="true" aria-labelledby="refill-confirm-heading" style={{width:'min(420px,100%)',background:'#152e43',border:'1px solid #b4985a',borderRadius:16,padding:24,color:'#eef3f7',boxShadow:'0 20px 80px #0008'}}>
   <h3 id="refill-confirm-heading" style={{margin:'0 0 12px'}}>補充しますか？</h3>
   {lead&&<p style={{fontSize:13,lineHeight:1.8,color:'#cad6df',margin:'0 0 8px'}}>{lead}</p>}
   <p style={{fontSize:13,lineHeight:1.8,color:'#cad6df',margin:0}}>{used?'今日の補充はもう使っています。明日また補充できます。':`今日の補充（1日1回）を使って、残高を${amount===null?'段位のレートの100BB':` ${amount.toLocaleString()} chip `}にします。`}</p>
   <div style={{display:'flex',justifyContent:'flex-end',gap:12,marginTop:22}}>
    <button type="button" onClick={onNo} style={{padding:'10px 14px',border:'1px solid #61788a',borderRadius:8,background:'transparent',color:'#eef3f7',font:'inherit',cursor:'pointer'}}>{used?'閉じる':'やめる'}</button>
    {!used&&<button type="button" autoFocus onClick={onYes} style={{padding:'10px 14px',border:'1px solid #a58a52',borderRadius:8,background:'#234156',color:'#fff0ca',font:'inherit',cursor:'pointer'}}>補充する</button>}
   </div>
  </section>
 </div>;
}

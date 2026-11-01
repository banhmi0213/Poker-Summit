'use client';
// Ring auto move (owner 2026/11/01): a short table moves its players to a busier table. Same rate (blinds and
// rake): automatic after a short countdown, with 「この卓に残る」. Another rate: the player is asked first.
// The move is the normal leave (chips back to the wallet after the hand) and a join at the new table.
import {useEffect,useMemo,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {RingLobbyState} from '@/lib/poker/ring-admission';
import {pickRingMove,RING_MOVE_COUNTDOWN_MS,RING_SHORT_WAIT_MS,type RingMove,type RingRake} from '@/lib/poker/ring-auto-move';
import styles from './ring-admission.module.css';

type Own=NonNullable<RingLobbyState['membership']>;
const rakeLabel=(r:RingRake|undefined)=>!r?'':r.bps<=500?'低レーキ':'高レーキ';

export function RingAutoMove({auth,data,own,tableId,blocked,leave}:{auth:SupabaseClient;data:RingLobbyState;own:Own|null;tableId:string;blocked:boolean;leave:()=>Promise<void>}){
 const [rakes,setRakes]=useState<Map<string,RingRake>>(new Map());
 const ids=data.tables.map(t=>t.id).join(',');
 useEffect(()=>{let live=true;const list=ids.split(',').filter(Boolean);if(!list.length)return;
  // Without the rakes nothing moves automatically (another rate always asks), so a failed read is safe.
  let read:PromiseLike<{data:unknown;error:unknown}>;try{read=auth.from('poker_ring_tables').select('id,rake_bps,rake_cap_bb').in('id',list);}catch{return;}
  void Promise.resolve(read).then(({data:rows,error})=>{if(!live||error||!Array.isArray(rows))return;
   setRakes(new Map((rows as {id:string;rake_bps:number;rake_cap_bb:number}[]).map(r=>[r.id,{bps:r.rake_bps,capBb:r.rake_cap_bb}])));},()=>{});
  return()=>{live=false;};},[auth,ids]);
 const current=data.tables.find(t=>t.id===tableId)??null;
 const seated=Boolean(own&&own.tableId===tableId&&own.status==='seated'&&!own.exitRequested);
 const stack=own?.stack??0;
 const move=useMemo(()=>seated&&current?pickRingMove(current,data.tables,rakes,stack,data.wallet.available):null,[seated,current,data.tables,rakes,stack,data.wallet.available]);
 const key=move?`${move.target.id}:${current?.occupied}:${move.target.occupied}`:null;
 // The table must stay short for a while (someone may be sitting down) before anything shows.
 const [ready,setReady]=useState<string|null>(null);
 useEffect(()=>{setReady(null);if(!key)return;const id=setTimeout(()=>setReady(key),RING_SHORT_WAIT_MS);return()=>clearTimeout(id);},[key]);
 const [declined,setDeclined]=useState<string|null>(null);
 const [moving,setMoving]=useState<RingMove|null>(null);
 const [left,setLeft]=useState(0);
 const shown=!moving&&move&&ready===key&&declined!==key?move:null;
 // Same rate: count down, then go.
 useEffect(()=>{if(!shown||!shown.sameRate)return;const end=Date.now()+RING_MOVE_COUNTDOWN_MS;setLeft(Math.ceil(RING_MOVE_COUNTDOWN_MS/1000));
  const id=setInterval(()=>{const s=Math.ceil((end-Date.now())/1000);setLeft(Math.max(0,s));if(s<=0){clearInterval(id);void go(shown);}},250);return()=>clearInterval(id);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[shown?.target.id,shown?.sameRate,key]);
 const going=useRef(false);
 // The move survives the table view switching (seated view to watching view) while the leave settles.
 const KEY='poker-ring-auto-move';
 async function go(m:RingMove){if(going.current||blocked)return;going.current=true;setMoving(m);
  try{window.sessionStorage.setItem(KEY,JSON.stringify({from:tableId,to:m.target.id,amount:m.amount,title:m.target.title,at:Date.now()}));}catch{}
  try{await leave();}catch{going.current=false;setMoving(null);try{window.sessionStorage.removeItem(KEY);}catch{}}}
 useEffect(()=>{let saved:{from?:string;to?:string;amount?:number;title?:string;at?:number}|null=null;try{saved=JSON.parse(window.sessionStorage.getItem(KEY)??'null');}catch{}
  if(!saved||saved.from!==tableId||typeof saved.to!=='string'||!Number.isSafeInteger(saved.amount)||Date.now()-(saved.at??0)>180000)return;
  if(!moving){const target=data.tables.find(t=>t.id===saved!.to);if(target)setMoving({target,sameRate:true,amount:saved.amount!});}
  // After the leave settles (chips back in the wallet), open the new table; it takes a free seat by itself.
  if(data.membership&&data.membership.tableId===tableId)return;
  try{window.sessionStorage.removeItem(KEY);}catch{}
  window.location.assign(`/poker-ring/${saved.to}?view=table&buyin=${saved.amount}&auto=1`);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[data.membership,tableId,moving]);
 if(moving)return <div className={styles.autoMove} role="status">{moving.target.title}へ移動しています。このハンドが終わるとチップを精算して、新しい卓に {moving.amount.toLocaleString()} chip で着席します。</div>;
 if(!shown)return null;
 const t=shown.target,rate=`${t.sb}/${t.bb}${rakeLabel(rakes.get(t.id))?`・${rakeLabel(rakes.get(t.id))}`:''}`;
 if(shown.sameRate)return <div className={styles.autoMove} role="status"><p>この卓の人数が少なくなりました。{left}秒後に、同じレートの卓（{t.title}・{t.occupied}人）へ移動します。</p><button type="button" onClick={()=>setDeclined(key)}>この卓に残る</button></div>;
 return <div className={styles.overlay}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="ring-move-heading"><h3 id="ring-move-heading">レートの違う卓へ移りますか？</h3>
  <p>この卓の人数が少なくなりました。同じレートで人のいる卓が空いていません。</p>
  <p><strong>{t.title}</strong>（{rate}・{t.occupied}人）へ、{shown.amount.toLocaleString()} chip を持って移ります。{shown.amount>stack?`足りない ${(shown.amount-stack).toLocaleString()} chip は残高から持ち込みます。`:shown.amount<stack?`残りの ${(stack-shown.amount).toLocaleString()} chip は残高に戻ります。`:''}</p>
  <div className={styles.actions}><button type="button" disabled={blocked} onClick={()=>void go(shown)}>移る</button><button type="button" onClick={()=>setDeclined(key)}>この卓に残る</button></div>
 </section></div>;
}

'use client';
import {CHIP_RESET_NOTICE} from './ring-monthly-view';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {parseRingWallet,type RingWallet} from '@/lib/poker/ring-wallet';
import {createClient} from '@/lib/supabase/client';
import styles from './chip-balance.module.css';
import {RefillConfirm} from './refill-confirm';
type Balance=RingWallet;
export function SummitChipBalance({detailed=false,presentation='card'}:{detailed?:boolean;presentation?:'card'|'lobby'}){
 const [balance,setBalance]=useState<Balance|null>(null),[message,setMessage]=useState('確認中'),[refilling,setRefilling]=useState(false),[refillNote,setRefillNote]=useState(''),[ask,setAsk]=useState(false);
 useEffect(()=>{let live=true,epoch=0,busy=false;const client=createClient();
  async function refresh(){if(busy)return;busy=true;const current=epoch;try{const {data,error}=await client.rpc('poker_ring_balance');if(!live||current!==epoch)return;if(error)throw Error();setBalance(parseRingWallet(data));setMessage('');}catch{if(live&&current===epoch){setBalance(null);setMessage('確認できません');}}finally{busy=false;}}
  let member:string|undefined;const subscription=client.auth.onAuthStateChange((event,session)=>{const next=session?.user.id??'';if(event==='SIGNED_OUT'||member!==undefined&&member!==next){epoch++;setBalance(null);setMessage('確認中');}member=next;});void refresh();const timer=setInterval(()=>void refresh(),15000);const focus=()=>void refresh();if(typeof window!=='undefined')window.addEventListener('focus',focus);
  return()=>{live=false;epoch++;clearInterval(timer);subscription.data.subscription.unsubscribe();if(typeof window!=='undefined')window.removeEventListener('focus',focus);};
 },[]);
 // Free refill (owner 2026/10/27): when the chips run out and nothing is at a table, top back up to 1,000 SC (owner 2026/10/31).
 async function refill(){if(refilling)return;setRefilling(true);setRefillNote('');try{const {data,error}=await createClient().rpc('poker_ring_refill',{p_request:crypto.randomUUID()});if(error)throw Error(error.message);setBalance(parseRingWallet(data));setRefillNote('補充しました。');}catch(e){setRefillNote(e instanceof Error&&e.message.includes('not needed')?'まだ補充できません（chipが残っているか、卓に座っています）。':e instanceof Error&&e.message.includes('Refill limit')?'補充は1日1回です。明日またお試しください。':'補充できませんでした。時間をおいてもう一度お試しください。');}finally{setRefilling(false);}}
 const canRefill=Boolean(balance&&balance.inPlay===0&&balance.available<50);
 if(presentation==='lobby')return <section className={styles.summary} aria-label="Summit chip残高"><span>あなたの持ちチップ</span><strong>{balance?balance.total.toLocaleString():message}<small>{balance?' chip':''}</small></strong><p>ランキング <b>{balance?.rank?`${balance.rank}位`:'—'}</b></p>{canRefill&&<button type="button" className={styles.refill} disabled={refilling} onClick={()=>setAsk(true)}>{refilling?'補充中':'chipを補充（1日1回）'}</button>}{refillNote&&<span role="status">{refillNote}</span>}<small className={styles.resetNote}>{CHIP_RESET_NOTICE}</small><RefillConfirm open={ask} onNo={()=>setAsk(false)} onYes={()=>{setAsk(false);void refill();}}/></section>;
 return <section className={styles.balance} aria-label="Summit chip残高"><span>Summit chip 所持枚数</span><strong>{balance?balance.total.toLocaleString():message}<small>{balance?' SC':''}</small></strong>{canRefill&&<button type="button" className={styles.refill} disabled={refilling} onClick={()=>setAsk(true)}>{refilling?'補充中':'chipを補充（1日1回）'}</button>}{refillNote&&<span role="status">{refillNote}</span>}{detailed&&balance&&<dl><div><dt>利用可能</dt><dd>{balance.available.toLocaleString()} SC</dd></div><div><dt>卓へ持ち込み中</dt><dd>{balance.inPlay.toLocaleString()} SC</dd></div><div><dt>チップ総数ランキング</dt><dd>{balance.rank===null?'—':`${balance.rank}位`}</dd></div></dl>}{detailed&&<p>リング用の残高です。大会やデモの持ち点は含みません。</p>}<RefillConfirm open={ask} onNo={()=>setAsk(false)} onYes={()=>{setAsk(false);void refill();}}/><p><Link href="/mypage/chips">残高・付与履歴を確認</Link></p></section>;
}

'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {parseRingWallet,type RingWallet} from '@/lib/poker/ring-wallet';
import {createClient} from '@/lib/supabase/client';
import styles from './chip-balance.module.css';
type Balance=RingWallet;
export function SummitChipBalance({detailed=false}:{detailed?:boolean}){
 const [balance,setBalance]=useState<Balance|null>(null),[message,setMessage]=useState('確認中'),[refilling,setRefilling]=useState(false),[refillNote,setRefillNote]=useState('');
 useEffect(()=>{let live=true,epoch=0,busy=false;const client=createClient();
  async function refresh(){if(busy)return;busy=true;const current=epoch;try{const {data,error}=await client.rpc('poker_ring_balance');if(!live||current!==epoch)return;if(error)throw Error();setBalance(parseRingWallet(data));setMessage('');}catch{if(live&&current===epoch){setBalance(null);setMessage('確認できません');}}finally{busy=false;}}
  let member:string|undefined;const subscription=client.auth.onAuthStateChange((event,session)=>{const next=session?.user.id??'';if(event==='SIGNED_OUT'||member!==undefined&&member!==next){epoch++;setBalance(null);setMessage('確認中');}member=next;});void refresh();const timer=setInterval(()=>void refresh(),15000);const focus=()=>void refresh();if(typeof window!=='undefined')window.addEventListener('focus',focus);
  return()=>{live=false;epoch++;clearInterval(timer);subscription.data.subscription.unsubscribe();if(typeof window!=='undefined')window.removeEventListener('focus',focus);};
 },[]);
 // Free refill (owner 2026/10/27): when the chips run out and nothing is at a table, top back up to 3,000 SC.
 async function refill(){if(refilling)return;setRefilling(true);setRefillNote('');try{const {data,error}=await createClient().rpc('poker_ring_refill',{p_request:crypto.randomUUID()});if(error)throw Error(error.message);setBalance(parseRingWallet(data));setRefillNote('3,000 SC を補充しました。');}catch(e){setRefillNote(e instanceof Error&&e.message.includes('not needed')?'まだ補充できません（卓に着ける分のchipが残っています）。':e instanceof Error&&e.message.includes('Refill limit')?'chipの補充は1日3回までです。明日またお試しください。':'補充できませんでした。時間をおいてもう一度お試しください。');}finally{setRefilling(false);}}
 const canRefill=Boolean(balance&&balance.inPlay===0&&balance.available<50);
 return <section className={styles.balance} aria-label="Summit chip残高"><span>Summit chip 所持枚数</span><strong>{balance?balance.total.toLocaleString():message}<small>{balance?' SC':''}</small></strong>{canRefill&&<button type="button" className={styles.refill} disabled={refilling} onClick={()=>void refill()}>{refilling?'補充中':'chipを補充（3,000 SC）'}</button>}{refillNote&&<span role="status">{refillNote}</span>}{detailed&&balance&&<dl><div><dt>利用可能</dt><dd>{balance.available.toLocaleString()} SC</dd></div><div><dt>卓へ持ち込み中</dt><dd>{balance.inPlay.toLocaleString()} SC</dd></div><div><dt>チップ総数ランキング</dt><dd>{balance.rank===null?'—':`${balance.rank}位`}</dd></div></dl>}{detailed&&<p>リング用の残高です。大会やデモの持ち点は含みません。</p>}<p><Link href="/mypage/chips">残高・付与履歴を確認</Link></p></section>;
}

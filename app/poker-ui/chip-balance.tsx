'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import styles from './chip-balance.module.css';
type Balance={available:number;inPlay:number;total:number;rank:number;asOf:string};
export function SummitChipBalance({detailed=false}:{detailed?:boolean}){
 const [balance,setBalance]=useState<Balance|null>(null),[message,setMessage]=useState('確認中');
 useEffect(()=>{let live=true,epoch=0,busy=false;const client=createClient();
  async function refresh(){if(busy)return;busy=true;const current=epoch;try{const {data,error}=await client.rpc('poker_ring_balance');if(!live||current!==epoch)return;if(error||!data||!['available','inPlay','total','rank'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0))throw Error();setBalance(data);setMessage('');}catch{if(live&&current===epoch){setBalance(null);setMessage('確認できません');}}finally{busy=false;}}
  let member:string|undefined;const subscription=client.auth.onAuthStateChange((event,session)=>{const next=session?.user.id??'';if(event==='SIGNED_OUT'||member!==undefined&&member!==next){epoch++;setBalance(null);setMessage('確認中');}member=next;});void refresh();const timer=setInterval(()=>void refresh(),15000);const focus=()=>void refresh();if(typeof window!=='undefined')window.addEventListener('focus',focus);
  return()=>{live=false;epoch++;clearInterval(timer);subscription.data.subscription.unsubscribe();if(typeof window!=='undefined')window.removeEventListener('focus',focus);};
 },[]);
 return <section className={styles.balance} aria-label="Summit chip残高"><span>Summit chip 所持枚数</span><strong>{balance?balance.total.toLocaleString():message}<small>{balance?' SC':''}</small></strong>{detailed&&balance&&<dl><div><dt>利用可能</dt><dd>{balance.available.toLocaleString()} SC</dd></div><div><dt>卓へ持ち込み中</dt><dd>{balance.inPlay.toLocaleString()} SC</dd></div><div><dt>チップ総数ランキング</dt><dd>{balance.rank}位</dd></div></dl>}{detailed&&<p>リング用の残高です。大会やデモの持ち点は含みません。</p>}</section>;
}

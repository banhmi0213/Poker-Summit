'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {parseShop,shopError,type ShopView} from '@/lib/poker/shop';
import styles from './wallet.module.css';
import {SKINS_FREE_FOR_NOW} from '@/lib/poker/skins';

/** Exchange: trade available Summit chips for ring tickets (time bank, rabbit). */
export function ChipShop({ticketLabels}:{ticketLabels:Record<string,string>}){
 const router=useRouter();
 const [shop,setShop]=useState<ShopView|null>(null),[message,setMessage]=useState('読み込み中'),[quantity,setQuantity]=useState<Record<string,number>>({});
 const [confirming,setConfirming]=useState<string|null>(null),[busy,setBusy]=useState(false),[request,setRequest]=useState<string|null>(null);
 useEffect(()=>{let live=true;void createClient().rpc('poker_shop').then(({data,error})=>{if(!live)return;try{if(error)throw error;setShop(parseShop(data));setMessage('');}catch{setMessage('交換所を読み込めませんでした。再読み込みしてください。');}});return()=>{live=false;};},[]);
 const exchange=async(item:string)=>{
  if(busy)return;setBusy(true);
  // Keep one request id per confirmed exchange so a retried tap is never charged twice.
  const id=request??crypto.randomUUID();setRequest(id);
  const {data,error}=await createClient().rpc('poker_shop_exchange',{p_item:item,p_quantity:quantity[item]??1,p_request:id});
  try{if(error)throw Error(error.message);setShop(parseShop(data));setMessage('交換しました。');setConfirming(null);setRequest(null);router.refresh();}
  catch(e){const m=e instanceof Error?e.message:undefined;setMessage(shopError(m));setConfirming(null);
   // A definite server refusal frees the id; an unknown failure keeps it so a retry cannot charge twice.
   if(m&&/Insufficient chips|Item unavailable|Login required|Invalid exchange|Request conflict|Already owned/.test(m))setRequest(null);}
  finally{setBusy(false);}
 };
 const skins=new Set(shop?.items.filter(i=>i.kind==='skin').map(i=>i.code)??[]),owned=shop?Object.entries(shop.tickets).filter(([code,n])=>n>0&&!skins.has(code)&&!/^(table|card_front|card_back)_/.test(code)):[];
 return <section className={styles.card} aria-labelledby="chip-shop-title">
  <h2 id="chip-shop-title">チップ交換所</h2>
  <p className={styles.shopLead}>使用可能なchipを、リングで使えるチケット{SKINS_FREE_FOR_NOW?'':'や卓・カードの着せ替え'}に交換できます。{SKINS_FREE_FOR_NOW?'卓・カードの着せ替えは、今はゲームメニューの設定から無料で選べます。':''}</p>
  <div className={styles.tickets} aria-label="持っているチケット">{owned.length?owned.map(([code,n])=><span key={code}>{ticketLabels[code]??code} <b>{n.toLocaleString()}枚</b></span>):<span>チケットはまだ持っていません。</span>}</div>
  {!shop?<p role="status">{message}</p>:!shop.items.length?<p>交換できる品は準備中です。</p>:<ul className={styles.shopItems}>{shop.items.filter(item=>!(SKINS_FREE_FOR_NOW&&item.kind==='skin')).map(item=>{const skin=item.kind==='skin',have=skin&&(shop.tickets[item.code]??0)>0,q=skin?1:quantity[item.code]??1,cost=item.price*q,short=shop.available<cost;
   if(have)return <li key={item.code}><div><strong>{item.label}</strong><small>{item.description}</small></div><div className={styles.shopBuy}><span className={styles.price}>交換済み・メニューの着せ替えで選べます</span></div></li>;
   return <li key={item.code}><div><strong>{item.label}</strong><small>{item.description}</small></div>
    <div className={styles.shopBuy}><span className={styles.price}>{item.price.toLocaleString()} chip{skin?'':'／枚'}</span>
     {!skin&&<label>枚数<select value={q} disabled={busy} onChange={e=>{setQuantity({...quantity,[item.code]:Number(e.target.value)});setConfirming(null);}}>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>}
     {confirming===item.code?<><span className={styles.confirmText}>{cost.toLocaleString()} chipを使って交換しますか？</span><button type="button" disabled={busy} onClick={()=>void exchange(item.code)}>交換する</button><button type="button" className={styles.secondary} disabled={busy} onClick={()=>setConfirming(null)}>やめる</button></>
      :<button type="button" disabled={busy||short} onClick={()=>{setConfirming(item.code);setMessage('');}}>{short?'chipが足りません':`${cost.toLocaleString()} chipで交換`}</button>}
    </div></li>;})}</ul>}
  {shop&&message&&<p role="status" className={styles.shopStatus}>{message}</p>}
  {shop&&shop.history.length>0&&<><h3 className={styles.shopHistoryTitle}>交換の履歴</h3><ul className={styles.history}>{shop.history.map((h,i)=><li key={`${h.createdAt}-${i}`}><div><strong>{h.label} ×{h.quantity}</strong><small>{new Date(h.createdAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（日本時間）</small></div><b>-{h.total.toLocaleString()} chip</b></li>)}</ul></>}
 </section>;
}

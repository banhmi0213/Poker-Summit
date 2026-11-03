'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {parseAdminShop,type AdminShopItem} from '@/lib/poker/shop';
export default function ShopPriceForm({item}:{item:AdminShopItem}){
 const [price,setPrice]=useState(item.price===null?'':String(item.price)),[active,setActive]=useState(item.active),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const save=async()=>{
  const value=price.trim()===''?null:Number(price);
  if(value!==null&&(!Number.isSafeInteger(value)||value<1||value>1000000)){setStatus('値段は1〜1,000,000の整数で入力してください（空欄なら交換所に並びません）。');return;}
  setBusy(true);setStatus('');
  const {data,error}=await createClient().rpc('poker_admin_shop_save',{p_item:item.code,p_price:value,p_active:active});
  try{if(error)throw error;const saved=parseAdminShop(data).find(i=>i.code===item.code);setStatus(saved?.price==null?'保存しました（値段未設定のため交換所には並びません）。':`保存しました（${saved.price.toLocaleString()} chip／枚${saved.active?'':'・停止中'}）。`);}
  catch{setStatus('保存できませんでした。');}finally{setBusy(false);}
 };
 return <form onSubmit={e=>{e.preventDefault();void save();}} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
  <label>値段（chip／枚） <input type="number" min={1} max={1000000} step={1} inputMode="numeric" value={price} placeholder="未設定" onChange={e=>setPrice(e.target.value)} style={{width:140}}/></label>
  <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> 交換所に出す</label>
  <button type="submit" className="btn" disabled={busy}>保存</button>
  {status&&<small role="status">{status}</small>}
 </form>;
}

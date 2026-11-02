'use client';
import {useEffect,useState} from 'react';
import {BACK_SKINS,CARD_SKINS,SKINS_FREE_FOR_NOW,TABLE_SKINS,skinUnlocked} from '@/lib/poker/skins';
import {useTablePreferences} from './table-preferences';
import {SKIN_STARTER_EVENT,SkinStarter} from './skin-starter';
import {CosmeticsSettings} from './my-cosmetics';
/** 卓・カードの着せ替え. Shop skins stay locked until exchanged in the chip shop (ticket count > 0). Hidden while only the standard designs exist. */
export function SkinSettings(){
 const {settings,change}=useTablePreferences(),[owned,setOwned]=useState<Record<string,number>>({});
 const needsShop=!SKINS_FREE_FOR_NOW&&[...TABLE_SKINS,...CARD_SKINS,...BACK_SKINS].some(s=>!s.free);
 useEffect(()=>{if(!needsShop)return;let live=true;// Loaded lazily and failure-tolerant: without the shop the paid skins simply stay locked.
  const load=()=>void import('@/lib/supabase/client').then(m=>m.createClient().rpc('poker_shop')).then(({data,error})=>{if(!live||error||!data||typeof data!=='object')return;const t=(data as {tickets?:unknown}).tickets;if(t&&typeof t==='object')setOwned(t as Record<string,number>);}).catch(()=>{});
  // Starter picks just made unlock their designs here too.
  load();const w=typeof window!=='undefined'&&typeof window.addEventListener==='function'?window:null;w?.addEventListener(SKIN_STARTER_EVENT,load);return()=>{live=false;w?.removeEventListener(SKIN_STARTER_EVENT,load);};},[needsShop]);
 if(TABLE_SKINS.length<2&&CARD_SKINS.length<2&&BACK_SKINS.length<2)return null;
 const group=(title:string,list:readonly {id:string;name:string;free:boolean;shopCode?:string;thumb?:string}[],value:string,key:'tableSkin'|'cardSkin'|'backSkin')=>list.length<2?null:<><h3>{title}</h3><div role="radiogroup" aria-label={title} style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(104px,1fr))',gap:8}}>{list.map(s=>{const open=skinUnlocked(s,owned);return <label key={s.id}><input type="radio" name={key} value={s.id} checked={value===s.id} disabled={!open} onChange={()=>change({[key]:s.id})}/>{s.thumb&&<img src={s.thumb} alt="" style={{width:96,height:'auto',display:'block',borderRadius:6}}/>}{s.name}{!open&&<small>（交換所・ハンド数特典で入手）</small>}</label>;})}</div></>;
 return <>{needsShop&&<SkinStarter variant="note"/>}{group('卓の着せ替え',TABLE_SKINS,settings.tableSkin,'tableSkin')}{group('カードの表',CARD_SKINS,settings.cardSkin,'cardSkin')}{group('カードの裏',BACK_SKINS,settings.backSkin,'backSkin')}<CosmeticsSettings kinds={['frame','plate']}/></>;
}

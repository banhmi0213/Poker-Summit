'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {BACK_SKINS,CARD_SKINS,TABLE_SKINS,skinUnlocked} from '@/lib/poker/skins';
import {useTablePreferences} from './table-preferences';
/** 卓・カードの着せ替え. Shop skins stay locked until exchanged in the chip shop (ticket count > 0). Hidden while only the standard designs exist. */
export function SkinSettings(){
 const {settings,change}=useTablePreferences(),[owned,setOwned]=useState<Record<string,number>>({});
 const needsShop=[...TABLE_SKINS,...CARD_SKINS,...BACK_SKINS].some(s=>!s.free);
 useEffect(()=>{if(!needsShop)return;let live=true;void createClient().rpc('poker_shop').then(({data,error})=>{if(!live||error||!data||typeof data!=='object')return;const t=(data as {tickets?:unknown}).tickets;if(t&&typeof t==='object')setOwned(t as Record<string,number>);});return()=>{live=false;};},[needsShop]);
 if(TABLE_SKINS.length<2&&CARD_SKINS.length<2&&BACK_SKINS.length<2)return null;
 const group=(title:string,list:readonly {id:string;name:string;free:boolean;shopCode?:string;thumb?:string}[],value:string,key:'tableSkin'|'cardSkin'|'backSkin')=>list.length<2?null:<><h3>{title}</h3><div role="radiogroup" aria-label={title}>{list.map(s=>{const open=skinUnlocked(s,owned);return <label key={s.id}><input type="radio" name={key} value={s.id} checked={value===s.id} disabled={!open} onChange={()=>change({[key]:s.id})}/>{s.thumb&&<img src={s.thumb} alt="" width={80} height={45} loading="lazy"/>}{s.name}{!open&&<small>（ショップで交換できます）</small>}</label>;})}</div></>;
 return <>{group('卓の着せ替え',TABLE_SKINS,settings.tableSkin,'tableSkin')}{group('カードの表',CARD_SKINS,settings.cardSkin,'cardSkin')}{group('カードの裏',BACK_SKINS,settings.backSkin,'backSkin')}</>;
}

'use client';
import {useEffect,useState} from 'react';
import {BACK_SKINS,CARD_SKINS,SKINS_FREE_FOR_NOW,TABLE_SKINS,skinUnlocked} from '@/lib/poker/skins';
import {useTablePreferences} from './table-preferences';
import {SKIN_STARTER_EVENT,SkinStarter} from './skin-starter';
import {kindHandsToNext,kindPicksLeft,parseSkinStatus,skinUnlockError,type SkinStatus} from '@/lib/poker/skin-unlocks';
import {CosmeticsSettings} from './my-cosmetics';
/** テーブル・カードの着せ替え. Non-standard designs come from the starter pick and ring-hand milestones (owner 2026/11/03: hands only, no chip
 * exchange); a design stays locked until owned (ticket count > 0). Hidden while only the standard designs exist. */
export function SkinSettings({starter=true}:{/** Show the free-pick note here (the lobby shows it beside its buttons instead). */starter?:boolean}={}){
 const {settings,change}=useTablePreferences(),[owned,setOwned]=useState<Record<string,number>>({});
 const [status,setStatus]=useState<SkinStatus|null>(null),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 const needsShop=!SKINS_FREE_FOR_NOW&&[...TABLE_SKINS,...CARD_SKINS,...BACK_SKINS].some(s=>!s.free);
 useEffect(()=>{if(!needsShop)return;let live=true;// Loaded lazily and failure-tolerant: without the shop the paid skins simply stay locked.
  const load=()=>void import('@/lib/supabase/client').then(m=>m.createClient().rpc('poker_shop')).then(({data,error})=>{if(!live||error||!data||typeof data!=='object')return;const t=(data as {tickets?:unknown}).tickets;if(t&&typeof t==='object')setOwned(t as Record<string,number>);}).catch(()=>{});
  // Starter picks just made unlock their designs here too.
  const loadStatus=()=>void import('@/lib/supabase/client').then(m=>m.createClient().rpc('poker_skin_status')).then(({data,error})=>{if(!live||error)return;try{setStatus(parseSkinStatus(data));}catch{}}).catch(()=>{});
  loadStatus();load();const w=typeof window!=='undefined'&&typeof window.addEventListener==='function'?window:null;w?.addEventListener(SKIN_STARTER_EVENT,load);return()=>{live=false;w?.removeEventListener(SKIN_STARTER_EVENT,load);};},[needsShop]);
 if(TABLE_SKINS.length<2&&CARD_SKINS.length<2&&BACK_SKINS.length<2)return null;
 const leftFor=(key:'tableSkin'|'cardSkin'|'backSkin')=>status?kindPicksLeft(status,key==='tableSkin'?'table':'card'):0;
 async function claim(code:string,key:'tableSkin'|'cardSkin'|'backSkin',id:string){
  if(busy)return;setBusy(true);setNote('');
  try{const {createClient}=await import('@/lib/supabase/client');const {data,error}=await createClient().rpc('poker_skin_milestone_claim',{p_item:code,p_request:crypto.randomUUID()});
   if(error)throw Error(error.message);setStatus(parseSkinStatus(data));setOwned(o=>({...o,[code]:1}));change({[key]:id});}
  catch(e){setNote(skinUnlockError(e instanceof Error?e.message:undefined));}
  finally{setBusy(false);}
 }
 const group=(title:string,list:readonly {id:string;name:string;free:boolean;shopCode?:string;thumb?:string}[],value:string,key:'tableSkin'|'cardSkin'|'backSkin')=>list.length<2?null:<><h3>{title}</h3><div role="radiogroup" aria-label={title} style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(104px,1fr))',gap:8}}>{list.map(s=>{const open=skinUnlocked(s,owned);return <label key={s.id}><input type="radio" name={key} value={s.id} checked={value===s.id} disabled={!open} onChange={()=>change({[key]:s.id})}/>{s.thumb&&<img src={s.thumb} alt="" style={{width:96,height:'auto',display:'block',borderRadius:6}}/>}{s.name}{!open&&(leftFor(key)>0&&s.shopCode?<button type="button" disabled={busy} onClick={e=>{e.preventDefault();void claim(s.shopCode!,key,s.id);}}>無料で選ぶ</button>:<small>（ハンド数特典で入手）</small>)}</label>;})}</div></>;
 const line=(label:string,kind:'card'|'table')=>{if(!status)return '';const left=kindPicksLeft(status,kind),next=kindHandsToNext(status,kind);return left>0?`${label}：今${left}つ無料で選べます`:next!==null?`${label}：あと${next.toLocaleString()}ハンドで1つ`:`${label}：すべて受け取りました`;};
 return <>{starter&&needsShop&&<SkinStarter variant="note"/>}{needsShop&&status&&<p style={{fontSize:12,margin:'0 0 8px',lineHeight:1.7}} aria-label="ハンド数特典">ハンド数特典（これまで {status.hands.toLocaleString()}ハンド）<br/>{line('トランプ','card')}<br/>{line('テーブル','table')}</p>}{note&&<p role="status" style={{fontSize:12}}>{note}</p>}{group('テーブルの着せ替え',TABLE_SKINS,settings.tableSkin,'tableSkin')}{group('カードの表',CARD_SKINS,settings.cardSkin,'cardSkin')}{group('カードの裏',BACK_SKINS,settings.backSkin,'backSkin')}<CosmeticsSettings kinds={['frame','plate']}/></>;
}

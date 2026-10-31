'use client';
import {useEffect,useState} from 'react';
import {BACK_SKINS,CARD_SKINS,TABLE_SKINS} from '@/lib/poker/skins';
import {parseSkinStatus,skinUnlockError,type SkinStatus} from '@/lib/poker/skin-unlocks';
import {useTablePreferences} from './table-preferences';
type Skin={id:string;name:string;shopCode?:string;thumb?:string};
/** Tells every open starter prompt and skin list that the starter picks were just made. */
export const SKIN_STARTER_EVENT='poker-skin-starter-done';
/** Owner 2026/10/31 (はじめにトランプ柄とテーブルを選択): a member's first free choice of a table, a card face and a
 * card back. Never forced: `card` is a prominent lobby card, `note` a small line in the skin settings; either opens the
 * picker on request and both disappear once chosen (or for guests / when the status cannot be read).
 * Later: paid designs and tournament-exclusive designs (Daniel) are granted through poker_private.skin_grant with their own
 * source, not through this picker. */
export function SkinStarter({variant='card',onDone}:{variant?:'card'|'note';onDone?:(s:SkinStatus)=>void}){
 const {save}=useTablePreferences();
 const [status,setStatus]=useState<SkinStatus|null>(null),[pick,setPick]=useState({tableSkin:TABLE_SKINS[0].id,cardSkin:CARD_SKINS[0].id,backSkin:BACK_SKINS[0].id}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[open,setOpen]=useState(false);
 useEffect(()=>{const done=()=>setStatus(v=>v?{...v,starterDone:true}:v);window.addEventListener(SKIN_STARTER_EVENT,done);return()=>window.removeEventListener(SKIN_STARTER_EVENT,done);},[]);
 useEffect(()=>{let live=true;void import('@/lib/supabase/client').then(m=>m.createClient().rpc('poker_skin_status')).then(({data,error})=>{if(!live||error)return;try{setStatus(parseSkinStatus(data));}catch{}}).catch(()=>{});return()=>{live=false;};},[]);
 if(!status||status.starterDone)return null;
 const code=(list:readonly Skin[],id:string)=>list.find(s=>s.id===id)?.shopCode??null;
 async function confirm(){
  if(busy)return;setBusy(true);setMessage('');
  try{const {createClient}=await import('@/lib/supabase/client');
   const {data,error}=await createClient().rpc('poker_skin_starter',{p_table:code(TABLE_SKINS,pick.tableSkin),p_face:code(CARD_SKINS,pick.cardSkin),p_back:code(BACK_SKINS,pick.backSkin)});
   if(error)throw Error(error.message);const next=parseSkinStatus(data);await save(pick);setStatus(next);onDone?.(next);window.dispatchEvent(new Event(SKIN_STARTER_EVENT));}
  catch(e){setMessage(skinUnlockError(e instanceof Error?e.message:undefined));}
  finally{setBusy(false);}
 }
 const group=(title:string,list:readonly Skin[],key:'tableSkin'|'cardSkin'|'backSkin')=><fieldset style={{border:0,padding:0,margin:'10px 0 0'}}><legend style={{fontWeight:700,marginBottom:6}}>{title}</legend>
  <div role="radiogroup" aria-label={title} style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(104px,1fr))',gap:8}}>{list.map(s=><label key={s.id} style={{display:'grid',gap:4,justifyItems:'center',textAlign:'center',fontSize:12,padding:6,borderRadius:8,border:`1px solid ${pick[key]===s.id?'#d6b364':'transparent'}`,cursor:'pointer'}}>
   <input type="radio" name={`starter-${variant}-${key}`} value={s.id} checked={pick[key]===s.id} onChange={()=>setPick({...pick,[key]:s.id})}/>{s.thumb&&<img src={s.thumb} alt="" style={{width:96,height:'auto',display:'block',borderRadius:6}}/>}{s.name}</label>)}</div></fieldset>;
 const openButton={minHeight:40,padding:'8px 20px',border:'1px solid #cfab59',borderRadius:8,background:'linear-gradient(140deg,#ffe8a8,#dfb761)',color:'#173449',fontWeight:700,cursor:'pointer'} as const;
 if(!open)return variant==='note'
  ?<p style={{fontSize:12,margin:'0 0 10px',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>はじめの着せ替えを1つずつ無料で選べます。<button type="button" onClick={()=>setOpen(true)} style={{...openButton,minHeight:32,padding:'5px 12px',fontSize:12}}>無料で選べます</button></p>
  :<section aria-label="はじめの着せ替え" style={{border:'1px solid #d6b364',borderRadius:12,padding:'14px 16px',margin:'0 0 16px',background:'#fbf5e8',color:'#203e51',display:'flex',gap:14,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
   <div><h2 style={{fontSize:17,margin:0}}>最初の着せ替えを1つずつ無料で選べます</h2><p style={{fontSize:12,margin:'4px 0 0',lineHeight:1.7}}>卓・カードの表・カードの裏から、好きなデザインを選べます（1回だけ）。選ばなくてもそのまま遊べます。</p></div>
   <button type="button" onClick={()=>setOpen(true)} style={openButton}>デザインを選ぶ</button></section>;
 return <section aria-labelledby={`skin-starter-title-${variant}`} style={{border:'1px solid #d6b364',borderRadius:12,padding:'14px 16px',margin:'0 0 16px',background:'#fbf5e8',color:'#203e51'}}>
  <h2 id={`skin-starter-title-${variant}`} style={{fontSize:17,margin:0}}>はじめに、好きなデザインを選んでください</h2>
  <p style={{fontSize:12,margin:'6px 0 0',lineHeight:1.7}}>卓・カードの表・カードの裏を1つずつ、無料で差し上げます（1回だけ）。ほかのデザインは、チップ交換所での交換や、リングのハンド数の特典で手に入ります。</p>
  {group('卓',TABLE_SKINS,'tableSkin')}{group('カードの表',CARD_SKINS,'cardSkin')}{group('カードの裏',BACK_SKINS,'backSkin')}
  <div style={{display:'flex',gap:12,alignItems:'center',marginTop:12,flexWrap:'wrap'}}><button type="button" disabled={busy} onClick={()=>void confirm()} style={openButton}>{busy?'保存中':'このデザインに決める'}</button><button type="button" disabled={busy} onClick={()=>setOpen(false)} style={{...openButton,background:'transparent'}}>あとで選ぶ</button>{message&&<span role="status" style={{fontSize:12}}>{message}</span>}</div>
 </section>;
}

'use client';
// 自分の見た目(アイコン枠・ネームプレート・スレッドデザイン)を読み込んで選ぶ(オーナー 2026/11/01)。
// 読み込めないとき(ログイン前・通信失敗・テスト環境)は全部「標準」のまま動く。
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {AvatarFrame} from '@/app/avatar-frame';
import {COSMETIC_ITEMS,COSMETICS_FREE_FOR_NOW,cosmeticUnlocked,frameStyle,plateStyle,threadStyle,validCode,type CosmeticKind,type Equipped} from '@/lib/cosmetics';
export const COSMETICS_EVENT='poker-cosmetics-changed';
type Status={equipped:Equipped;owned:string[];freeForNow:boolean};
const EMPTY:Status={equipped:{frame:null,plate:null,thread:null},owned:[],freeForNow:COSMETICS_FREE_FOR_NOW};
function parse(v:unknown):Status|null{if(!v||typeof v!=='object')return null;const s=v as {equipped?:Record<string,unknown>;owned?:unknown;freeForNow?:unknown};const e=s.equipped??{};
 return {equipped:{frame:validCode(e.frame,'frame'),plate:validCode(e.plate,'plate'),thread:validCode(e.thread,'thread')},owned:Array.isArray(s.owned)?s.owned.filter((x):x is string=>typeof x==='string'):[],freeForNow:s.freeForNow===true};}
async function client(){try{return (await import('@/lib/supabase/client')).createClient();}catch{return null;}}
export function useMyCosmetics(){
 const [status,setStatus]=useState<Status>(EMPTY),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;const load=()=>void client().then(c=>c?.rpc('poker_cosmetics_status')).then(r=>{if(!live||!r||r.error)return;const s=parse(r.data);if(s)setStatus(s);}).catch(()=>{});
  load();const w=typeof window!=='undefined'&&typeof window.addEventListener==='function'?window:null;w?.addEventListener(COSMETICS_EVENT,load);return()=>{live=false;w?.removeEventListener(COSMETICS_EVENT,load);};},[]);
 const equip=useCallback(async(kind:CosmeticKind,code:string|null)=>{
  if(busy)return;setBusy(true);setMessage('');
  const next={...status.equipped,[kind]:code};
  try{const c=await client();if(!c)throw Error('unavailable');const {data,error}=await c.rpc('poker_cosmetics_equip',{p_frame:next.frame,p_plate:next.plate,p_thread:next.thread});if(error)throw error;
   const s=parse(data);if(s)setStatus(s);setMessage('保存しました。');
   if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event(COSMETICS_EVENT));
  }catch{setMessage('保存できませんでした。ログイン状態をご確認のうえ、もう一度お試しください。');}finally{setBusy(false);}
 },[busy,status.equipped]);
 return {status,equip,busy,message};
}
/** 自分のアイコンに、選んでいる枠を付ける(ロビー・プレイヤーページの見出しなど)。 */
export function MyFrame({children}:{children:ReactNode}){const {status}=useMyCosmetics();return <AvatarFrame code={status.equipped.frame}>{children}</AvatarFrame>;}
const TITLES:Record<CosmeticKind,string>={frame:'アイコン枠',plate:'ネームプレート',thread:'サミットのスレッドデザイン'};
function Preview({kind,code}:{kind:CosmeticKind;code:string|null}){
 if(kind==='frame')return <span style={{display:'inline-flex',padding:4}}><AvatarFrame code={code}><span style={{width:34,height:34,borderRadius:'50%',background:'#2f4b5f',display:'block'}}/></AvatarFrame></span>;
 if(kind==='plate'){const st=plateStyle(code);return <span style={{display:'inline-flex',flexDirection:'column',alignItems:'center',minWidth:72,padding:'3px 6px',border:'1px solid #b79754',borderRadius:7,background:'#12110e',color:'#fff0c5',fontSize:11,lineHeight:1.3,...st}}><b>NAME</b><small style={{color:st?.color??'#6dd9ed'}}>1,000</small></span>;}
 const t=threadStyle(code);return <span style={{display:'block',width:'100%',border:'1px solid #c9b78a',borderRadius:10,overflow:'hidden',background:'#fff',...t.card}}>{t.band&&<span style={{display:'block',...t.band}}/>}<span style={{display:'block',padding:'4px 6px',fontSize:11,color:'#2b2b2b'}}>スレッド{t.badge&&<span style={t.badge.style}>{t.badge.text}</span>}</span></span>;
}
/** アイコン枠・ネームプレート・スレッドデザインを選ぶ。kinds で出す種類を絞れる。 */
export function CosmeticsSettings({kinds=['frame','plate','thread']}:{kinds?:CosmeticKind[]}){
 const {status,equip,busy,message}=useMyCosmetics();
 return <div aria-label="見た目の設定">
  {kinds.map(kind=><section key={kind}><h3>{TITLES[kind]}</h3>
   <div role="radiogroup" aria-label={TITLES[kind]} style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(104px,1fr))',gap:8}}>
    {COSMETIC_ITEMS[kind].map(item=>{const code=item.shopCode??null,open=cosmeticUnlocked(item,status.owned,status.freeForNow||COSMETICS_FREE_FOR_NOW),on=status.equipped[kind]===code;
     return <button key={item.id} type="button" role="radio" aria-checked={on} disabled={busy||!open} onClick={()=>void equip(kind,code)}
      style={{display:'grid',justifyItems:'center',gap:6,padding:8,border:on?'2px solid #d6b364':'1px solid #8a7a55',borderRadius:8,background:on?'#d6b36422':'transparent',color:'inherit',font:'inherit',cursor:open?'pointer':'default',opacity:open?1:.55}}>
      <Preview kind={kind} code={code}/><span style={{fontSize:12,fontWeight:700}}>{item.name}</span>{!open&&<small>準備中</small>}
     </button>;})}
   </div>
  </section>)}
  {(status.freeForNow||COSMETICS_FREE_FOR_NOW)&&<p style={{fontSize:11,opacity:.8}}>現在は確認のため、すべて無料で選べます（仮のデザインです）。</p>}
  {message&&<p role="status" style={{fontSize:12}}>{message}</p>}
 </div>;
}

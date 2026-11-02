'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {defaultBetPreferences,parseBetPreferences,type BetPreferences} from '@/lib/poker/bet-presets';
const Context=createContext<{settings:BetPreferences;change:(patch:Partial<BetPreferences>)=>void;/** patch: changes to apply and save at once (a plain change() is not visible to save() until the next render). */save:(patch?:Partial<BetPreferences>)=>Promise<void>;status:string}>({settings:defaultBetPreferences,change:()=>{},save:async()=>{},status:''});
export function TablePreferences({children}:{children:ReactNode}){
 const [settings,setSettings]=useState(defaultBetPreferences),[status,setStatus]=useState(''),account=useRef<string|null>(null);
 useEffect(()=>{let active=true;fetch('/api/poker/table-preferences',{cache:'no-store'}).then(async r=>{if(!active)return;if(r.ok){const v=await r.json();if(!active)return;account.current=v.accountId;setSettings(parseBetPreferences(v.settings));setStatus('会員設定を読み込みました');}else setStatus('ゲスト設定：この画面でのみ有効');}).catch(()=>active&&setStatus('設定を読み込めませんでした'));return()=>{active=false;};},[]);
 const save=async(patch?:Partial<BetPreferences>)=>{let next=settings;if(patch){try{next=parseBetPreferences({...settings,...patch});}catch{}setSettings(next);}if(!account.current){setStatus('保存にはログインが必要です');return;}setStatus('保存中…');try{const r=await fetch('/api/poker/table-preferences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:account.current,settings:next})}),v=await r.json();if(!r.ok)throw Error(v.error||'保存できませんでした');setStatus('会員設定を保存しました');}catch(e){setStatus(e instanceof Error?e.message:'保存できませんでした');}};
 return <Context.Provider value={{settings,change:patch=>setSettings(v=>{try{return parseBetPreferences({...v,...patch});}catch{return v;}}),save,status}}>{children}</Context.Provider>;
}
export const useTablePreferences=()=>useContext(Context);
export function formatTableChips(value:number|null,bb:number,showBB:boolean){if(value===null)return '—';return showBB&&bb>0?`${(value/bb).toLocaleString('ja-JP',{maximumFractionDigits:2})} BB`:value.toLocaleString();}

'use client';
import {useTablePreferences} from './table-preferences';
import {SkinSettings} from './skin-settings';
import {useEffect,useState} from 'react';

/** A setting number that can be cleared and retyped freely (2026/10/27: 「手打ちで全部消えるように」).
 * The value applies when it is a valid number in range; on Enter or leaving the box an empty or out-of-range entry
 * goes back to the last value / is kept inside the range. */
export function SettingNumber({value,min,max,ariaLabel,onChange}:{value:number;min:number;max:number;ariaLabel:string;onChange:(n:number)=>void}){
 const [draft,setDraft]=useState(String(value)),[editing,setEditing]=useState(false);
 useEffect(()=>{if(!editing)setDraft(String(value));},[value,editing]);
 const parse=(t:string)=>{const n=Number(t.replace(/[^\d.]/g,''));return t.trim()!==''&&Number.isFinite(n)?n:null;};
 const commit=()=>{setEditing(false);const n=parse(draft);if(n===null){setDraft(String(value));return;}const c=Math.min(max,Math.max(min,n));onChange(c);setDraft(String(c));};
 return <input aria-label={ariaLabel} type="text" inputMode="decimal" autoComplete="off" value={draft}
  onFocus={()=>setEditing(true)}
  onChange={e=>{const t=e.target.value.replace(/[^\d.]/g,'').slice(0,6);setDraft(t);const n=parse(t);if(n!==null&&n>=min&&n<=max)onChange(n);}}
  onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();e.currentTarget.blur();}}}/>;
}
export function BetSizeSettings(){const {settings,change,save,status}=useTablePreferences();return <><h3>プリフロップ：BB倍率</h3>{settings.multipliers.map((v,i)=><label key={'bb'+i}>ボタン {i+1}<SettingNumber ariaLabel={`プリフロップ BB倍率 ${i+1}`} min={1} max={20} value={v} onChange={x=>change({multipliers:settings.multipliers.map((n,j)=>i===j?x:n)})}/> BB</label>)}<h3>フロップ以降：POTの割合</h3>{settings.potPercentages.map((v,i)=><label key={'pot'+i}>ボタン {i+1}<SettingNumber ariaLabel={`フロップ以降 POT割合 ${i+1}`} min={1} max={500} value={v} onChange={x=>change({potPercentages:settings.potPercentages.map((n,j)=>i===j?x:n)})}/> %</label>)}<h3>相手のベット・レイズに対して：倍率</h3>{settings.raiseMultipliers.map((v,i)=><label key={'x'+i}>ボタン {i+1}<SettingNumber ariaLabel={`相手のベット・レイズに対する倍率 ${i+1}`} min={1.1} max={20} value={v} onChange={x=>change({raiseMultipliers:settings.raiseMultipliers.map((n,j)=>i===j?x:n)})}/> 倍</label>)}<SkinSettings/><h3>トゥワイス設定</h3><label><select aria-label="トゥワイス設定" value={settings.runItTwice} onChange={e=>change({runItTwice:e.target.value as 'ask'|'twice'|'once'})}><option value="ask">毎回確認</option><option value="once">1回</option><option value="twice">2回</option></select></label><small>2回は、関係する全員が2回を選んだときだけになります。</small><button type="button" onClick={()=>void save()}>レイズ額設定を保存</button><small role="status">{status}</small></>;}

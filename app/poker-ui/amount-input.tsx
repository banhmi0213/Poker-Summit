'use client';
import {useEffect,useState} from 'react';
/** Typed bet amount: digits can be typed freely (no clamping on every keystroke, which made 625 impossible to type
 * when the minimum is 400). A value inside the legal range applies at once; anything else is clamped on Enter or blur. */
/** raw: pass every typed value through (the caller disables its button while the value is out of range). */
export function AmountInput({value,min,max,disabled,onChange,className,ariaLabel,id,raw=false}:{value:number;min:number;max:number;disabled?:boolean;onChange:(n:number)=>void;className?:string;ariaLabel:string;id?:string;raw?:boolean}){
 const [draft,setDraft]=useState(String(value)),[editing,setEditing]=useState(false);
 useEffect(()=>{if(!editing)setDraft(String(value));},[value,editing]);
 const commit=()=>{setEditing(false);const n=Math.round(Number(draft.replace(/[^\d]/g,'')));if(!draft.trim()||!Number.isFinite(n)){setDraft(String(value));return;}const c=Math.min(max,Math.max(min,n));onChange(c);setDraft(String(c));};
 return <input id={id} className={className} aria-label={ariaLabel} type="text" inputMode="numeric" autoComplete="off" value={draft} disabled={disabled}
  onFocus={e=>{setEditing(true);e.currentTarget.select();}}
  onChange={e=>{const input=String(e.target.value);if(raw){setDraft(input.slice(0,12));onChange(input.trim()===''?NaN:Number(input));return;}const t=input.replace(/[^\d]/g,'').slice(0,12);setDraft(t);const n=Number(t);if(t&&Number.isSafeInteger(n)&&n>=min&&n<=max)onChange(n);}}
  onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();(e.currentTarget as HTMLInputElement).blur();}}}/>;
}

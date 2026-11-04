'use client';
import {useEffect,useRef} from 'react';
import type {GtoTool,GtoAction} from '@/lib/gto-usage';
/** Fire-and-forget, one UUID per operation. Never retry with a new ID. */
export function trackGtoUsage(tool:GtoTool,action:GtoAction){
 try{
  if(/(^|; )ps_staff=1/.test(document.cookie))return;
  const payload=JSON.stringify({event_id:crypto.randomUUID(),tool,action});
  if(!navigator.sendBeacon?.('/api/gto-usage',new Blob([payload],{type:'application/json'})))
   void fetch('/api/gto-usage',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true}).catch(()=>{});
 }catch{/* Analytics must never affect the tool. */}
}
/** Ref survives StrictMode's effect replay; a genuine tab remount counts again. */
export function useGtoUsage(tool:GtoTool|null,viewKey:string=tool??''){
 const last=useRef<string|null>(null);
 useEffect(()=>{if(!tool){last.current=null;return;}if(last.current===viewKey)return;last.current=viewKey;trackGtoUsage(tool,'open');},[tool,viewKey]);
}
/** These quizzes show their first question immediately: mounting starts the exercise.
 * Each accepted answer sends exactly one answer row, outside React state updaters. */
export function useGtoAnswer(tool:GtoTool,learnOnly=false){
 const begun=useRef(false);
 useEffect(()=>{if(learnOnly&&!location.pathname.startsWith('/learn'))return;if(begun.current)return;begun.current=true;trackGtoUsage(tool,'start');},[tool,learnOnly]);
 return ()=>{if(learnOnly&&!location.pathname.startsWith('/learn'))return;trackGtoUsage(tool,'answer');};
}

export function GtoUsageOpen({tool,viewKey}:{tool:GtoTool;viewKey?:string}){useGtoUsage(tool,viewKey);return null;}

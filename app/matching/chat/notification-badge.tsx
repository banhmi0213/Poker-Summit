"use client";
import {useEffect,useState} from 'react';
export function NotificationBadge({actor}:{actor:'store'|'dealer'}){
 const [count,setCount]=useState(0);
 useEffect(()=>{let active=true;const abort=new AbortController();const load=async()=>{if(document.visibilityState!=='visible')return;try{const result=await fetch('/api/matching/notifications?actor='+actor,{cache:'no-store',signal:abort.signal});if(result.ok){const data=await result.json();if(active)setCount(Number(data.count)||0);}}catch{}};load();const timer=setInterval(load,30000);document.addEventListener('visibilitychange',load);window.addEventListener('matching-notifications-changed',load);return()=>{active=false;abort.abort();clearInterval(timer);document.removeEventListener('visibilitychange',load);window.removeEventListener('matching-notifications-changed',load);};},[actor]);
 return count>0?<span role="status" aria-label={`未読通知 ${count}件`} style={{display:'inline-block',marginLeft:8,padding:'2px 8px',borderRadius:20,background:'#aa3b28',color:'#fff',fontSize:11,fontWeight:700}}>{count>99?'99+':count}</span>:null;
}

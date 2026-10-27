'use client';
import {useState} from 'react';
import {STAMPS,STAMP_GAP_MS,stampLabel,type StampId} from '@/lib/poker/stamps';
import styles from './stamp-bar.module.css';
/** A stamp shown over a seat for a few seconds (the server stops sending it after STAMP_SHOW_MS). */
export function StampBubble({stamp}:{stamp:string}){const label=stampLabel(stamp);return label?<span className={styles.bubble} role="status" aria-label={`スタンプ：${label}`}>{label}</span>:null;}
/** Fixed stamps for seated players (no free text). */
export function StampBar({onStamp,disabled}:{onStamp:(stamp:StampId)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[cool,setCool]=useState(false);
 const send=(id:StampId)=>{if(cool)return;onStamp(id);setOpen(false);setCool(true);setTimeout(()=>setCool(false),STAMP_GAP_MS);};
 return <div className={styles.bar}><button type="button" className={styles.toggle} aria-expanded={open} disabled={disabled} onClick={()=>setOpen(v=>!v)}>スタンプ</button>
  {open&&<div className={styles.list} role="group" aria-label="スタンプを送る">{STAMPS.map(s=><button type="button" key={s.id} disabled={disabled||cool} onClick={()=>send(s.id)}>{s.label}</button>)}</div>}</div>;
}

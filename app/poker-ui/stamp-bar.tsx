'use client';
import {useState} from 'react';
import {STAMPS,STAMP_GAP_MS,stampOf,type Stamp,type StampId} from '@/lib/poker/stamps';
import styles from './stamp-bar.module.css';
/** Sticker: Daniel's drawing when it exists, else the Summit thumb with the phrase (manga-style outline). */
function Sticker({s,size}:{s:Stamp;size:'bubble'|'pick'}){
 return <span className={styles.sticker} data-size={size} data-tone={s.tone}>
  {s.image?<img src={s.image} alt="" className={styles.art}/>:<><span className={styles.burst} aria-hidden="true"/><img src="/images/summit-finger-clean.webp" alt="" className={styles.thumb}/></>}
  <b className={styles.phrase}>{s.label}</b>{size==='pick'&&<small className={styles.sub}>{s.sub}</small>}
 </span>;
}
/** A stamp shown over a seat for a few seconds (the server stops sending it after STAMP_SHOW_MS). */
export function StampBubble({stamp}:{stamp:string}){const s=stampOf(stamp);return s?<span className={styles.bubble} role="status" aria-label={`スタンプ：${s.label}`}><Sticker s={s} size="bubble"/></span>:null;}
/** Fixed stamps for seated players (no free text). */
export function StampBar({onStamp,disabled}:{onStamp:(stamp:StampId)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[cool,setCool]=useState(false);
 const send=(id:StampId)=>{if(cool)return;onStamp(id);setOpen(false);setCool(true);setTimeout(()=>setCool(false),STAMP_GAP_MS);};
 return <div className={styles.bar}><button type="button" className={styles.toggle} aria-expanded={open} disabled={disabled} onClick={()=>setOpen(v=>!v)}>スタンプ</button>
  {open&&<div className={styles.list} role="group" aria-label="スタンプを送る">{STAMPS.map(s=><button type="button" key={s.id} aria-label={s.label} disabled={disabled||cool} onClick={()=>send(s.id)}><Sticker s={s} size="pick"/></button>)}</div>}</div>;
}

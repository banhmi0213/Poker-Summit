'use client';
import {useEffect,useState} from 'react';
import {STAMPS,STAMP_GAP_MS,STAMP_SHOW_MS,stampOf,type Stamp,type StampId} from '@/lib/poker/stamps';
import styles from './stamp-bar.module.css';
/** Sticker (owner 2026/10/27): Daniel's character without a frame, the phrase laid over the character, one line. */
function Sticker({s,size}:{s:Stamp;size:'bubble'|'pick'}){
 return <span className={styles.sticker} data-size={size} data-tone={s.tone} data-long={s.label.length>=6?'':undefined}>
  {s.image?<img src={s.image} alt="" className={styles.art} draggable={false}/>:<img src="/images/summit-finger-clean.webp" alt="" className={styles.thumb}/>}
  <b className={styles.phrase}>{s.label}</b>
 </span>;
}
/** A big stamp over the sender's avatar and cards for 3 seconds (owner 2026/10/27). `age`: ms since it was sent.
 * `hand`: the current hand; when a new hand starts while it is shown, it goes away at once so the new cards are seen. */
export function StampBubble({stamp,age=0,hand}:{stamp:string;age?:number;hand?:string|null}){
 const s=stampOf(stamp),[shown,setShown]=useState(true),[startHand]=useState(hand);
 useEffect(()=>{setShown(true);const t=window.setTimeout(()=>setShown(false),Math.max(0,STAMP_SHOW_MS-age));return()=>window.clearTimeout(t);},[stamp,age]);
 return s&&shown&&hand===startHand?<span className={styles.bubble} data-stamp-bubble role="status" aria-label={`スタンプ：${s.label}`}><Sticker s={s} size="bubble"/></span>:null;
}
/** Fixed stamps for seated players (no free text). */
export function StampBar({onStamp,disabled}:{onStamp:(stamp:StampId)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[cool,setCool]=useState(false);
 const send=(id:StampId)=>{if(cool)return;onStamp(id);setOpen(false);setCool(true);setTimeout(()=>setCool(false),STAMP_GAP_MS);};
 return <div className={styles.bar}><button type="button" className={styles.toggle} aria-expanded={open} disabled={disabled} onClick={()=>setOpen(v=>!v)}>スタンプ</button>
  {open&&<div className={styles.list} role="group" aria-label="スタンプを送る">{STAMPS.map(s=><button type="button" key={s.id} aria-label={s.label} disabled={disabled||cool} onClick={()=>send(s.id)}><Sticker s={s} size="pick"/></button>)}</div>}</div>;
}

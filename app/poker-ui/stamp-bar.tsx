'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
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
/** Each posted stamp is shown once (owner 2026/10/29: スタンプ１回押したら２回出る). A stamp is the same post when it is
 * the same picture at the same seat and its post time (now − age) is within 2 s; a later read of it never shows it again. */
const shownPosts=new Map<string,number>();
export function StampBubble({stamp,age=0,hand,seat}:{stamp:string;age?:number;hand?:string|null;seat?:number}){
 const s=stampOf(stamp),[shown,setShown]=useState(false),[startHand]=useState(hand),post=useRef<number|null>(null);
 useEffect(()=>{const key=`${hand??''}:${seat??''}:${stamp}`,postedAt=Date.now()-age,known=shownPosts.get(key);
  const same=known!==undefined&&Math.abs(known-postedAt)<2000;const at=same?known!:postedAt;if(!same)shownPosts.set(key,postedAt);
  if(shownPosts.size>200)for(const [k,v] of shownPosts)if(Date.now()-v>60000)shownPosts.delete(k);
  if(post.current===at)return;post.current=at;
  const left=STAMP_SHOW_MS-(Date.now()-at);if(left<=0){setShown(false);return;}
  setShown(true);const t=window.setTimeout(()=>setShown(false),left);return()=>window.clearTimeout(t);},[stamp,age,hand,seat]);
 return s&&shown&&hand===startHand?<span className={styles.bubble} data-stamp-bubble role="status" aria-label={`スタンプ：${s.label}`}><Sticker s={s} size="bubble"/></span>:null;
}
/** Fixed stamps for seated players (no free text). */
export function StampBar({onStamp,disabled}:{onStamp:(stamp:StampId)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[cool,setCool]=useState(false);
 const send=(id:StampId)=>{if(cool)return;onStamp(id);setOpen(false);setCool(true);setTimeout(()=>setCool(false),STAMP_GAP_MS);};
 return <div className={styles.bar}><button type="button" className={styles.toggle} aria-expanded={open} disabled={disabled} onClick={()=>setOpen(v=>!v)}>スタンプ</button>
  {open&&<div className={styles.list} role="group" aria-label="スタンプを送る">{STAMPS.map(s=><button type="button" key={s.id} aria-label={s.label} disabled={disabled||cool} onClick={()=>send(s.id)}><Sticker s={s} size="pick"/></button>)}</div>}</div>;
}

/** Round buttons beside your own avatar (owner 2026/10/27: 左にスタンプとサミット): stamps and the Summit board.
 * The stamp list and the board open as sheets over the page, so they never get cut off at the table edge. */
export function SeatQuickBar({onStamp,disabled,extra}:{onStamp:(stamp:StampId)=>void;disabled?:boolean;/** Shown under the round buttons: ticket +20s, rabbit (owner 2026/10/29). */extra?:import('react').ReactNode}){
 const [open,setOpen]=useState<'stamp'|'summit'|null>(null),[cool,setCool]=useState(false),[mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(null);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open]);
 const send=(id:StampId)=>{if(cool)return;onStamp(id);setOpen(null);setCool(true);setTimeout(()=>setCool(false),STAMP_GAP_MS);};
 const sheet=open&&mounted?createPortal(<div className={styles.sheetBackdrop} data-kind={open} onClick={()=>setOpen(null)}>
  {open==='stamp'?<div className={styles.sheetList} role="group" aria-label="スタンプを送る" onClick={e=>e.stopPropagation()}>{STAMPS.map(s=><button type="button" key={s.id} aria-label={s.label} disabled={disabled||cool} onClick={()=>send(s.id)}><Sticker s={s} size="pick"/></button>)}</div>
  :<div className={styles.summitSheet} role="dialog" aria-label="サミット掲示板" onClick={e=>e.stopPropagation()}><div className={styles.summitHead}><strong>サミット</strong><button type="button" aria-label="サミットを閉じる" onClick={()=>setOpen(null)}>×</button></div><iframe title="サミット掲示板" src="/poker-community" referrerPolicy="same-origin"/></div>}
 </div>,document.body):null;
 return <div className={styles.quick} role="group" aria-label="スタンプとサミット">
  <button type="button" className={styles.quickBtn} aria-label="サミット" aria-expanded={open==='summit'} onClick={()=>setOpen(v=>v==='summit'?null:'summit')}><span className={styles.quickIcon} data-kind="summit"><img src="/images/summit-finger-clean.webp" alt="" data-summit/></span><span className={styles.quickLabel} aria-hidden="true">サミット</span></button>
  <button type="button" className={styles.quickBtn} aria-label="スタンプ" aria-expanded={open==='stamp'} disabled={disabled} onClick={()=>setOpen(v=>v==='stamp'?null:'stamp')}><span className={styles.quickIcon}><img src="/images/stamps/stamp-02.webp" alt=""/></span><span className={styles.quickLabel} aria-hidden="true">スタンプ</span></button>
  {extra&&<div className={styles.quickExtra}>{extra}</div>}
  {sheet}
 </div>;
}

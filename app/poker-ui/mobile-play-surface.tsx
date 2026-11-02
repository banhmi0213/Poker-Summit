'use client';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import styles from './mobile-play-surface.module.css';

/** Keep one portal host when moving between the page and the mobile play surface:
 * switching presentation must never redeal a hand or reset an unanswered question. */
export function MobilePlaySurface({children,label}:{children:ReactNode;label:string}){
 const anchor=useRef<HTMLDivElement>(null),openButton=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const [host,setHost]=useState<HTMLDivElement|null>(null),[full,setFull]=useState(false);
 useLayoutEffect(()=>{const el=document.createElement('div');el.className=styles.host;anchor.current?.appendChild(el);setHost(el);return()=>{el.remove();};},[]);
 useLayoutEffect(()=>{
  if(!host)return;
  if(!full){anchor.current?.appendChild(host);return;}
  const previous=document.body.style.overflow,focused=document.activeElement as HTMLElement|null;
  document.body.appendChild(host);document.body.style.overflow='hidden';closeButton.current?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();setFull(false);}
   if(e.key==='Tab'){
    const buttons=[...host.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,input,[tabindex="0"]')].filter(x=>x.getClientRects().length);
    const first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKey);anchor.current?.appendChild(host);(openButton.current??focused)?.focus();};
 },[host,full]);
 useEffect(()=>{const m=window.matchMedia('(max-width:700px)'),change=()=>{if(!m.matches)setFull(false);};m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 const content=<div className={full?styles.full:undefined} data-mobile-play-fullscreen={full||undefined} role={full?'dialog':undefined} aria-modal={full||undefined} aria-label={full?`${label}・全画面`:undefined}>
  <div className={styles.toolbar}>
   {full?<><strong>{label}</strong><button ref={closeButton} type="button" onClick={()=>setFull(false)}>全画面を閉じる</button></>:<button ref={openButton} type="button" onClick={()=>setFull(true)}>全画面でプレイ</button>}
  </div>
  <div className={full?styles.content:undefined}>{children}</div>
 </div>;
 return <div ref={anchor}>{host?createPortal(content,host):children}</div>;
}

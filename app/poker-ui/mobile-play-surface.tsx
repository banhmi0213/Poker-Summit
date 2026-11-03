'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import styles from './mobile-play-surface.module.css';
const PlaySlots=createContext<{mobile:boolean;actions:HTMLDivElement|null;feedback:HTMLDivElement|null;tools:HTMLSpanElement|null}>({mobile:false,actions:null,feedback:null,tools:null});

/** Only the controls move into the dock; the game state stays in its original component. */
export function MobilePlayControls({children,mobileChildren}:{children:ReactNode;mobileChildren?:ReactNode}){
 const slots=useContext(PlaySlots);
 return slots.mobile&&slots.actions?createPortal(<div data-play-controls>{mobileChildren??children}</div>,slots.actions):<>{children}</>;
}
export function MobilePlayFeedback({children}:{children:ReactNode}){
 const slots=useContext(PlaySlots);
 return slots.mobile&&slots.feedback?createPortal(children,slots.feedback):<>{children}</>;
}
export function MobilePlaySettings({children,active,reviewCount,onOpenChange,label='連打の設定'}:{label?:string;children:ReactNode;active:boolean;reviewCount:number;onOpenChange:(open:boolean)=>void}){
 const slots=useContext(PlaySlots),sheet=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),enabled=slots.mobile&&active;
 useEffect(()=>{
  onOpenChange(open&&enabled);
  const dialog=sheet.current;
  if(open&&enabled){if(dialog&&!dialog.open)dialog.showModal();}
  else if(dialog?.open)dialog.close();
 },[open,enabled,onOpenChange]);
 useEffect(()=>{if(!enabled)setOpen(false);},[enabled]);
 if(!enabled)return <>{children}</>;
 const button=<button ref={trigger} type="button" className={styles.settingsButton} aria-label={reviewCount?`設定・復習 ${reviewCount}問`:'設定'} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>設定{reviewCount>0&&<span className={styles.reviewBadge} aria-hidden="true">{reviewCount}</span>}</button>;
 return <>{slots.tools?createPortal(button,slots.tools):button}<dialog ref={sheet} className={styles.sheet} aria-label={label} onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientY<r.top)setOpen(false);}}}>
  <header><strong>{label}</strong><button type="button" autoFocus onClick={()=>setOpen(false)}>閉じる</button></header>
  <div onClick={e=>{if((e.target as HTMLElement).closest('button'))setOpen(false);}}>{children}</div>
 </dialog></>;
}

/** Keep one portal host when moving between the page and the mobile play surface:
 * switching presentation must never redeal a hand or reset an unanswered question. */
export function MobilePlaySurface({children,label,startFullscreen=false}:{children:ReactNode;label:string;startFullscreen?:boolean}){
 const anchor=useRef<HTMLDivElement>(null),openButton=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const [host,setHost]=useState<HTMLDivElement|null>(null),[full,setFull]=useState(false);
 const [mobile,setMobile]=useState(false),[actions,setActions]=useState<HTMLDivElement|null>(null),[feedback,setFeedback]=useState<HTMLDivElement|null>(null),[tools,setTools]=useState<HTMLSpanElement|null>(null),[dockHeight,setDockHeight]=useState(0);
 const dock=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const el=document.createElement('div');el.className=styles.host;anchor.current?.appendChild(el);setHost(el);return()=>{el.remove();};},[]);
 useLayoutEffect(()=>{
  if(!host)return;
  if(!full){anchor.current?.appendChild(host);return;}
  const previous=document.body.style.overflow,focused=document.activeElement as HTMLElement|null;
  document.body.appendChild(host);document.body.style.overflow='hidden';closeButton.current?.focus();
  const onKey=(e:KeyboardEvent)=>{
   const dialog=host.querySelector<HTMLDialogElement>('dialog[open]');
   if(e.key==='Escape'){if(dialog)return;e.preventDefault();setFull(false);}
   if(e.key==='Tab'){
    const buttons=[...(dialog??host).querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,input,[tabindex="0"]')].filter(x=>x.getClientRects().length);
    const first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKey);anchor.current?.appendChild(host);(openButton.current??focused)?.focus();};
 },[host,full]);
 useLayoutEffect(()=>{const m=window.matchMedia('(max-width:700px)'),change=()=>{setMobile(m.matches);if(!m.matches)setFull(false);};change();m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 useLayoutEffect(()=>{const el=dock.current;if(!el||!mobile){setDockHeight(0);return;}const measure=()=>setDockHeight(Math.ceil(el.getBoundingClientRect().height));measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[mobile,host]);
 useEffect(()=>{if(startFullscreen&&window.matchMedia('(max-width:700px)').matches)setFull(true);},[startFullscreen]);
 const content=<PlaySlots.Provider value={{mobile,actions,feedback,tools}}><div className={`${styles.root} ${full?styles.full:''}`} style={{'--play-dock-height':`${dockHeight}px`} as CSSProperties} data-mobile-play-fullscreen={full||undefined} role={full?'dialog':undefined} aria-modal={full||undefined} aria-label={full?`${label}・全画面`:undefined}>
  <div className={styles.toolbar}>
   {full&&<strong>{label}</strong>}<div className={styles.toolbarActions}><span ref={setTools}/>{full?<button ref={closeButton} type="button" onClick={()=>setFull(false)}>全画面を閉じる</button>:<button ref={openButton} type="button" onClick={()=>setFull(true)}>全画面でプレイ</button>}</div>
  </div>
  <div className={styles.content}>{children}</div>
  <div ref={dock} className={styles.dock}><div ref={setFeedback} className={styles.dockFeedback}/><div ref={setActions} className={styles.dockActions}/></div>
 </div></PlaySlots.Provider>;
 return <div ref={anchor}>{host?createPortal(content,host):children}</div>;
}

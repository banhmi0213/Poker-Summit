'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {TablePreferences} from './table-preferences';
import {SummitChipBalance} from './chip-balance';
import styles from './game-community.module.css';
export function GameCommunity({children}:{children:ReactNode}){
 const [desktop,setDesktop]=useState(false),[open,setOpen]=useState(false),[target,setTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>{const update=()=>setTarget(document.getElementById('poker-community-slot'));update();const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);
 useEffect(()=>{const media=window.matchMedia('(min-width:900px)'),update=()=>{setDesktop(media.matches);if(!media.matches)setOpen(false);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return <TablePreferences><div className={styles.layout} data-open={open}>{children}{desktop&&target&&createPortal(<aside className={styles.dock} aria-label="サミット連携"><SummitChipBalance/><button className={styles.toggle} type="button" aria-expanded={open} aria-controls="poker-community-frame" onClick={()=>setOpen(v=>!v)}>{open?'掲示板を閉じる ×':'掲示板を開く'}</button>{open?<iframe id="poker-community-frame" title="サミット掲示板への投稿と返信" src="/poker-community" referrerPolicy="same-origin"/>:<p>掲示板をここに開き、プレイ画面のまま投稿・返信できます。</p>}</aside>,target)}</div></TablePreferences>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {SHARE_PROMPT_GAP_MS,SHARE_PROMPT_SHOW_MS,shareMoment} from '@/lib/poker/share-moment';
import type {RingPlayView} from '@/lib/poker/ring-play-state';
import styles from './share-prompt.module.css';
const KEY='poker.sharePromptAt';
const lastShown=()=>{try{return Number(window.localStorage.getItem(KEY)??0)||0;}catch{return 0;}};
const markShown=()=>{try{window.localStorage.setItem(KEY,String(Date.now()));}catch{}};
/** Shown for a few seconds after a memorable hand; at most once every 30 minutes per browser; closes with ×. */
export function SharePrompt({play}:{play:RingPlayView|null|undefined}){
 const [moment,setMoment]=useState<ReturnType<typeof shareMoment>>(null),seen=useRef<string|null>(null);
 const m=shareMoment(play);
 useEffect(()=>{if(!m||seen.current===m.handId)return;seen.current=m.handId;if(Date.now()-lastShown()<SHARE_PROMPT_GAP_MS)return;markShown();setMoment(m);},[m?.handId]);
 useEffect(()=>{if(!moment)return;const t=setTimeout(()=>setMoment(null),SHARE_PROMPT_SHOW_MS);return()=>clearTimeout(t);},[moment]);
 if(!moment)return null;
 return <div className={styles.toast} role="status"><p>{moment.text}。掲示板でみんなに見せませんか？</p>
  <a href={`/mypage/poker/hands/${moment.handId}?share=1`} target="_blank" rel="noopener">このハンドを共有する</a>
  <button type="button" aria-label="閉じる" onClick={()=>setMoment(null)}>×</button></div>;
}

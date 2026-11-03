'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {StrategyAction} from './strategy-colors';
import {HandDetail} from './hand-detail';
import styles from './gto-chart.module.css';
export function PreflopHandDetail({hand,actions,freqs,onClose}:{hand:string|null;actions:readonly StrategyAction[];freqs:readonly number[]|null|undefined;onClose:()=>void}){
 const [mobile,setMobile]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 useLayoutEffect(()=>{const m=matchMedia('(max-width:700px)'),update=()=>setMobile(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
 useEffect(()=>{const el=dialog.current;if(!mobile||!hand){if(el?.open)el.close();return;}const previous=document.body.style.overflow;document.body.style.overflow='hidden';if(el&&!el.open)el.showModal();return()=>{document.body.style.overflow=previous;};},[mobile,hand]);
 if(!mobile)return <HandDetail hand={hand} actions={actions} freqs={freqs}/>;
 return <><p className={styles.handDetailHint}>マスを押すと、割合が下から開きます。</p><dialog ref={dialog} className={styles.handSheet} aria-label="選んだ手の割合" onClose={onClose} onClick={e=>{if(e.target===e.currentTarget&&e.clientY<e.currentTarget.getBoundingClientRect().top)dialog.current?.close();}}><header><strong>選んだ手の割合</strong><button type="button" autoFocus onClick={()=>dialog.current?.close()}>閉じる</button></header><HandDetail hand={hand} actions={actions} freqs={freqs}/></dialog></>;
}

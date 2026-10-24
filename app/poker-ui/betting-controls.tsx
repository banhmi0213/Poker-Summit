'use client';
import {useEffect,useState} from 'react';
import type {BettingAction} from '@/lib/poker/betting';
import type {RingPlayView} from '@/lib/poker/ring-play-state';
import {ringWagerAction} from '@/lib/poker/ring-wager-action';
import {useAutoAction} from './use-auto-action';
import {formatTableChips,useTablePreferences} from './table-preferences';
import styles from './betting-controls.module.css';
export function BettingControls({hand,blocked,seconds,bank,onTimeBank,onAction}:{hand:RingPlayView['hand']|null;blocked:boolean;seconds:number|null;bank?:{seconds:number;remaining:number};onTimeBank?:()=>void;onAction:(a:BettingAction)=>void}){
 const legal=hand?.legal??null,{settings}=useTablePreferences(),[amount,setAmount]=useState(0);useEffect(()=>setAmount(legal?.minRaiseTo??0),[hand?.handId,hand?.revision,legal?.minRaiseTo]);
 const auto=useAutoAction(hand?.handId??null,hand?.revision??0,legal,blocked,onAction),bb=hand?.terms.bb??0,fmt=(n:number)=>formatTableChips(n,bb,settings.bb)+(settings.bb?'':' chip'),min=legal?.minRaiseTo??0,max=legal?.maxRaiseTo??0,valid=Number.isSafeInteger(amount)&&amount>=min&&amount<=max,canRaise=!blocked&&Boolean(legal?.raise);
 const manual=(a:BettingAction)=>{auto.cancel();onAction(a);};
 return <section className={styles.panel} aria-label="操作パネル"><div className={styles.turn}><strong>{hand?.result?'ハンド終了':legal?'あなたの番':hand?.toAct?`プレイヤー ${hand.toAct.slice(5)}の番`:'開始待ち'}{seconds!==null&&!hand?.result&&<> · <span>{seconds}秒</span></>}</strong><button type="button" className={styles.bank} disabled={blocked||!legal||!bank?.remaining||!onTimeBank} onClick={onTimeBank} aria-label={`タイムバンク +${bank?.seconds??20}秒（残り${bank?.remaining??0}回）`}><b>◷</b><small>+{bank?.seconds??20}s</small><small>残り{bank?.remaining??0}回</small></button></div>
 <label className={styles.amount}>ベット後の合計額 <strong>{legal?.raise?fmt(amount):'—'}</strong><input aria-label="ベット後の合計" type="number" inputMode="numeric" min={min} max={max} value={String(amount)} disabled={!canRaise} onChange={e=>setAmount(Number(e.target.value))}/></label>
 <input className={styles.slider} aria-label="ベット額スライダー" type="range" min={min} max={Math.max(min,max)} step={1} value={amount} disabled={!canRaise} onChange={e=>setAmount(Number(e.target.value))}/>
 <div className={styles.quick}>{settings.multipliers.map((m,i)=><button type="button" key={i} disabled={!canRaise} onClick={()=>setAmount(Math.min(max,Math.max(min,Math.round(m*bb))))}>{m}×</button>)}<button type="button" disabled={!canRaise} onClick={()=>setAmount(max)}>ALL-IN額</button></div>
 <small className={styles.limits}>{legal?.raise?`最小 ${fmt(min)} ／ 最大 ${fmt(max)}`:legal?.call?`コール ${fmt(legal.callAmount)}`:' '}</small>
 <div className={styles.actions}><button type="button" className={styles.fold} disabled={blocked||!legal?.fold} onClick={()=>manual({type:'fold'})}>フォールド</button><button type="button" className={styles.check} disabled={blocked||!legal?.check} onClick={()=>manual({type:'check'})}>チェック</button><button type="button" className={styles.call} disabled={blocked||!legal?.call} onClick={()=>manual({type:'call'})}>コール{legal?.call&&<small>{fmt(legal.callAmount)}</small>}</button><button type="button" className={styles.raise} disabled={!canRaise||!valid} onClick={()=>hand&&manual(ringWagerAction(hand,amount))}>{legal?.shortAllInOnly?'オールイン':'レイズ'}</button></div>
 <div className={styles.auto}><span>自動アクション</span><button type="button" aria-pressed={auto.mode==='check'} disabled={blocked||!hand||Boolean(hand.result)} onClick={()=>auto.toggle('check')}>オートチェック {auto.mode==='check'?'ON':'OFF'}</button><button type="button" aria-pressed={auto.mode==='fold'} disabled={blocked||!hand||Boolean(hand.result)} onClick={()=>auto.toggle('fold')}>オートフォールド {auto.mode==='fold'?'ON':'OFF'}</button></div>
 </section>;
}

'use client';
import {MobileWagerEditor} from './mobile-wager-editor';
import {AmountInput} from './amount-input';
import {quickBetKind,quickBetLabel,quickBetTo,quickBetValues} from '@/lib/poker/bet-presets';
import {useEffect,useState} from 'react';
import type {BettingAction} from '@/lib/poker/betting';
import type {RingPlayView} from '@/lib/poker/ring-play-state';
import {ringWagerAction} from '@/lib/poker/ring-wager-action';
import {useAutoAction} from './use-auto-action';
import {formatTableChips,useTablePreferences} from './table-preferences';
import styles from './betting-controls.module.css';
export function BettingControls({hand,blocked,seconds,bank,onTimeBank,onAction}:{hand:RingPlayView['hand']|null;blocked:boolean;seconds:number|null;bank?:{seconds:number;remaining:number;cards?:number};onTimeBank?:()=>void;onAction:(a:BettingAction)=>void}){
 const [mobileRaiseOpen,setMobileRaiseOpen]=useState(false);
 const legal=hand?.legal??null,{settings}=useTablePreferences(),[amount,setAmount]=useState(0);useEffect(()=>setAmount(legal?.minRaiseTo??0),[hand?.handId,hand?.revision,legal?.minRaiseTo]);
 const auto=useAutoAction(hand?.handId??null,hand?.revision??0,legal,blocked,onAction),bb=hand?.terms.bb??0,fmt=(n:number)=>formatTableChips(n,bb,settings.bb)+(settings.bb?'':' chip'),min=legal?.minRaiseTo??0,max=legal?.maxRaiseTo??0,valid=Number.isSafeInteger(amount)&&amount>=min&&amount<=max,canRaise=!blocked&&Boolean(legal?.raise);
 const preflop=!hand||hand.street==='preflop',pot=hand?.pot??0,own=hand?.players.find(p=>p.id===hand.toAct),currentBet=Math.max(0,...(hand?.players.map(p=>p.committed)??[0])),kind=quickBetKind({preflop,currentBet,bb}),sizes=quickBetValues(kind,settings),sizeTo=(m:number)=>quickBetTo(kind,{value:m,bb,pot,call:legal?.callAmount??0,committed:own?.committed??0,currentBet,min,max});
 useEffect(()=>setMobileRaiseOpen(false),[hand?.handId,hand?.revision,blocked]);
 const manual=(a:BettingAction)=>{setMobileRaiseOpen(false);auto.cancel();onAction(a);};
 return <section className={styles.panel} aria-label="操作パネル">{mobileRaiseOpen&&canRaise&&<MobileWagerEditor amount={amount} min={min} max={max} step={bb} format={fmt} label={legal?.shortAllInOnly?'オールイン':hand?.players.some(p=>p.committed>0)?'レイズ':'ベット'} onChange={setAmount} onClose={()=>setMobileRaiseOpen(false)} onConfirm={()=>hand&&valid&&manual(ringWagerAction(hand,amount))} presets={[...sizes.map(m=>({label:quickBetLabel(kind,m),amount:sizeTo(m)})),{label:'ALL-IN額',amount:max}]}/>}<div className={styles.turn}><strong>{hand?.result?'ハンド終了':legal?'あなたの番':hand?.toAct?`プレイヤー ${hand.toAct.slice(5)}の番`:'開始待ち'}{seconds!==null&&!hand?.result&&<> · <span>{seconds}秒</span></>}</strong></div>
 <label className={styles.amount}>ベット後の合計額 <strong>{legal?.raise?fmt(amount):'—'}</strong><AmountInput raw ariaLabel="ベット後の合計" value={amount} min={min} max={max} disabled={!canRaise} onChange={setAmount}/></label>
 <input className={styles.slider} aria-label="ベット額スライダー" type="range" min={min} max={Math.max(min,max)} step={1} value={amount} disabled={!canRaise} onChange={e=>setAmount(Number(e.target.value))}/>
 <div className={styles.quick}>{sizes.map((m,i)=><button type="button" key={i} disabled={!canRaise} onClick={()=>setAmount(sizeTo(m))}>{quickBetLabel(kind,m)}</button>)}<button type="button" disabled={!canRaise} onClick={()=>setAmount(max)}>ALL-IN額</button></div>
 <small className={styles.limits}>{legal?.raise?`最小 ${fmt(min)} ／ 最大 ${fmt(max)}`:legal?.call?`コール ${fmt(legal.callAmount)}`:' '}</small>
 <div className={styles.actions}><button type="button" className={styles.fold} disabled={blocked||!legal?.fold} onClick={()=>manual({type:'fold'})}>フォールド</button>{legal?.call?<button type="button" className={styles.call} disabled={blocked} onClick={()=>manual({type:'call'})}>コール<small>{fmt(legal.callAmount)}</small></button>:<button type="button" className={styles.check} disabled={blocked||!legal?.check} onClick={()=>manual({type:'check'})}>チェック</button>}<button type="button" className={styles.raise} disabled={!canRaise||!valid} onClick={()=>{if(typeof window!=="undefined"&&typeof window.matchMedia==="function"&&window.matchMedia("(max-width:899px)").matches){if(mobileRaiseOpen&&hand)manual(ringWagerAction(hand,amount));else setMobileRaiseOpen(true);}else if(hand)manual(ringWagerAction(hand,amount));}}>{legal?.shortAllInOnly?'オールイン':hand?.players.some(p=>p.committed>0)?'レイズ':'ベット'}{canRaise&&<small>{fmt(amount)}</small>}</button></div>
 <div className={styles.auto}><span>自動アクション</span><button type="button" aria-pressed={auto.mode==='check'} disabled={blocked||!hand||Boolean(hand.result)} onClick={()=>auto.toggle('check')}>オートチェック {auto.mode==='check'?'ON':'OFF'}</button><button type="button" aria-pressed={auto.mode==='fold'} disabled={blocked||!hand||Boolean(hand.result)} onClick={()=>auto.toggle('fold')}>オートフォールド {auto.mode==='fold'?'ON':'OFF'}</button></div>
 </section>;
}

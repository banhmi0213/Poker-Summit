'use client';
import {useAutoAction} from '@/app/poker-ui/use-auto-action';
import {useEffect,useState} from 'react';
import type {PlayerSnapshot} from '@/lib/poker/player-client';
import type {BettingAction} from '@/lib/poker/betting';
import shared from '../../poker-demo/poker-table.module.css';
import styles from './table.module.css';
type Props={state:PlayerSnapshot|null;busy:boolean;pending:boolean;enabled:boolean;message:string;onJoin:()=>void;onSpectate:()=>void;onRetry:()=>void;onTimeBank?:()=>void;onAct:(action:BettingAction)=>void};
export function OnlineControls({state,busy,pending,enabled,message,onJoin,onSpectate,onRetry,onAct,onTimeBank}:Props){
 const [amount,setAmount]=useState('');useEffect(()=>setAmount(''),[state?.hand?.handId,state?.hand?.revision]);
 const legal=state?.hand?.legal,locked=busy||pending||!enabled||Boolean(state?.turn&&state.turn.expiresAt<=state.serverNow),wager=Number(amount||legal?.minRaiseTo);
 const valid=Number.isSafeInteger(wager)&&legal?.minRaiseTo!=null&&legal.maxRaiseTo!=null&&wager>=legal.minRaiseTo&&wager<=legal.maxRaiseTo;
 const auto=useAutoAction(state?.hand?.handId??null,state?.hand?.revision??0,legal??null,locked,onAct);
 return <div className={shared.controls}><div><button type="button" aria-pressed={auto.mode==='check'} disabled={locked||!state?.hand||Boolean(state.hand.result)} onClick={()=>auto.toggle('check')}>オートチェック {auto.mode==='check'?'ON':'OFF'}</button><button type="button" aria-pressed={auto.mode==='fold'} disabled={locked||!state?.hand||Boolean(state.hand.result)} onClick={()=>auto.toggle('fold')}>オートフォールド {auto.mode==='fold'?'ON':'OFF'}</button></div>
  <div className={shared.turn}>{legal?'あなたの番':state?.phase==='finished'?'大会終了':state?.phase==='complete'?'次のハンドを待っています':state?.hand?.toAct?`プレイヤー ${state.hand.toAct.replace('seat-','')}の番`:'開始待ち'}</div>
  <button type="button" className={styles.bankButton} disabled={locked||!legal||!state?.timeBank?.remaining||!onTimeBank} onClick={onTimeBank}>◷ タイムバンク +{state?.timeBank?.seconds??20}秒（残り{state?.timeBank?.remaining??0}回）</button>
  {!enabled&&<p role="status">オンライン対戦サーバーはまだ公開していません。現在のデモはロビーから利用できます。</p>}
  <p role="status">{message}</p>{!state&&<p>割り当て済みの参加者は、参加ボタンで空席に自動着席します。</p>}
  <div className={styles.connectionControls}><button type="button" disabled={busy||!enabled} onClick={onJoin}>参加・接続・再接続</button><button type="button" disabled={locked} onClick={onSpectate}>観戦</button>{pending&&<button type="button" disabled={busy} onClick={onRetry}>前の操作の結果を確認</button>}</div>
  <div className={`${shared.actions} ${styles.actionButtons}`} aria-label="アクション">
   <button type="button" disabled={locked||!legal?.fold} onClick={()=>onAct({type:'fold'})}>フォールド</button>
   <button type="button" disabled={locked||!legal?.check} onClick={()=>onAct({type:'check'})}>チェック</button>
   <button type="button" disabled={locked||!legal?.call} onClick={()=>onAct({type:'call'})}>コール {legal?.callAmount??0}</button>
  </div>
  <label>ベット後の合計 <input aria-label="ベット後の合計" type="number" inputMode="numeric" min={legal?.minRaiseTo??0} max={legal?.maxRaiseTo??0} value={amount||legal?.minRaiseTo||''} onChange={e=>setAmount(e.target.value)} disabled={locked||!legal?.raise}/></label>
  <div className={`${shared.quickBets} ${styles.quickBets}`}>{[2,3,4].map(m=><button type="button" key={m} disabled={locked||!legal?.raise} onClick={()=>setAmount(String(Math.max(legal!.minRaiseTo!,Math.min(legal!.maxRaiseTo!,m*(state?.hand?.terms.bb??0)))))}>{m}×BB</button>)}<button type="button" disabled={locked||!legal?.raise} onClick={()=>setAmount(String(legal?.maxRaiseTo))}>ALL-IN額</button></div>
  <button type="button" className={styles.raiseButton} disabled={locked||!legal?.raise||!valid} onClick={()=>onAct({type:state?.hand?.players.some(p=>p.committed>0)?'raise':'bet',amount:wager})}>{legal?.shortAllInOnly?'オールイン':'ベット・レイズ'}</button>
 </div>;
}

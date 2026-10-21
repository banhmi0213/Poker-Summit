'use client';
import {useEffect,useRef,useState} from 'react';
import type {RingPlayView} from '@/lib/poker/ring-play-state';
import type {BettingAction} from '@/lib/poker/betting';
import {PokerSounds} from '@/lib/poker/online-sounds';
import {SummitMark} from './brand-mark';
import {useRingRunout} from './use-ring-runout';
import {usePotFlight} from './use-pot-flight';
import styles from './ring-live-table.module.css';
type Card=RingPlayView['hand']['board'][number];
function Cards({cards}:{cards:Card[]|null}){return <span className={styles.cards}>{(cards??[null,null]).map((c,i)=><span key={i} className={c?styles.card:styles.back} data-red={Boolean(c&&(c.suit==='h'||c.suit==='d'))}>{c?<>{({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[c.rank]??c.rank}{({c:'♣',d:'♦',h:'♥',s:'♠'})[c.suit]}</>:<SummitMark/>}</span>)}</span>;}
export default function RingLiveTable({play:incoming,blocked,onAction}:{play:RingPlayView;blocked:boolean;onAction:(action:BettingAction)=>void}){
 const play=useRingRunout(incoming);
 const s=play.hand,legal=s.legal,[amount,setAmount]=useState(''),[now,setNow]=useState(play.serverNow),[muted,setMuted]=useState(false),audio=useRef<PokerSounds|null>(null),last=useRef<{hand:string;revision:number;board:number;turn:string|null;won:boolean}|null>(null);
 const flight=usePotFlight(Boolean(s.result),s.handId);
 useEffect(()=>{const local=Date.now(),server=play.serverNow;setNow(server);const timer=setInterval(()=>setNow(server+Date.now()-local),100);return()=>clearInterval(timer);},[play.serverNow]);
 useEffect(()=>{const sound=new PokerSounds();audio.current=sound;const unlock=()=>void sound.unlock();document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);sound.close();audio.current=null;};},[]);
 useEffect(()=>{audio.current?.setEnabled(!muted);},[muted]);
 useEffect(()=>{const prior=last.current;if(!prior||prior.hand!==s.handId)audio.current?.play('deal');else if(!prior.won&&s.result)audio.current?.play('win');else if(prior.board!==s.board.length)audio.current?.play('deal');else if(prior.revision!==s.revision)audio.current?.play('action');if(s.toAct===play.viewerSeat&&(!prior||prior.turn!==s.toAct||prior.revision!==s.revision))audio.current?.play('turn');last.current={hand:s.handId,revision:s.revision,board:s.board.length,turn:s.toAct,won:Boolean(s.result)};},[s.handId,s.revision,s.board.length,s.result,s.toAct,play.viewerSeat]);
 useEffect(()=>{setAmount(legal?.minRaiseTo===null||legal?.minRaiseTo===undefined?'':String(legal.minRaiseTo));},[s.handId,s.revision,legal?.minRaiseTo]);
 const seconds=play.deadline===null?0:Math.max(0,Math.ceil((play.deadline-now)/1000)),elapsed=play.deadline===null?100:Math.min(100,Math.max(0,100-(play.deadline-now)/300)),disabled=blocked||play.hand.handId!==incoming.hand.handId||play.hand.revision!==incoming.hand.revision||play.deadline===null||now>=play.deadline;
 const wager=Number(amount),valid=legal?.raise&&Number.isSafeInteger(wager)&&wager>=legal.minRaiseTo!&&wager<=legal.maxRaiseTo!;
 const act=(action:BettingAction)=>{void audio.current?.unlock().then(()=>audio.current?.play('action'));onAction(action);};
 return <div className={styles.game}><div className={styles.bar}><span>SB {s.terms.sb} / BB {s.terms.bb}</span><span role="status">{s.result?'勝敗確定':s.toAct?`${s.toAct===play.viewerSeat?'あなた':`プレイヤー ${s.toAct.slice(5)}`}の番 · ${seconds}秒`:'カード公開中'}</span><button type="button" onClick={()=>{void audio.current?.unlock();setMuted(v=>!v);}}>SE {muted?'OFF':'ON'}</button></div>
 <div ref={flight} className={styles.felt} data-board-count={s.board.length} data-result={Boolean(s.result)}>
 <div className={styles.board}><small>{s.street.toUpperCase()}</small><div>{s.board.length?<Cards cards={s.board}/>:<span className={styles.waiting}>COMMUNITY CARDS</span>}</div><strong data-pot-source>POT {s.pot.toLocaleString()} chip</strong></div>
 <div className={styles.seats} data-count={s.players.length}>{s.players.map(p=><section key={p.id} className={styles.player} data-folded={p.folded} data-own={p.id===play.viewerSeat} data-turn={p.id===s.toAct}>
 <div className={styles.avatar} data-pot-target={p.id}><SummitMark/>{p.id===s.toAct&&<svg viewBox="0 0 64 64" aria-label={`残り${seconds}秒`}><circle cx="32" cy="32" r="29" pathLength="100" strokeDasharray="100" strokeDashoffset={-elapsed}/></svg>}</div>
 <strong>プレイヤー {p.id.slice(5)}{p.id===play.viewerSeat?'（あなた）':''}</strong><div className={styles.positions}>{s.positions.button===p.id&&<span>BTN</span>}{s.positions.sb===p.id&&<span>SB</span>}{s.positions.bb===p.id&&<span>BB</span>}</div>
 <Cards cards={p.hole}/><b>{p.stack.toLocaleString()} chip</b><small>{s.result?.payouts[p.id]?`獲得 +${s.result.payouts[p.id].toLocaleString()}`:p.folded?'フォールド':p.allIn?'オールイン':`ベット ${p.committed.toLocaleString()}`}</small></section>)}</div>
 {s.result?.winners.map(winner=><span className={styles.flight} key={s.handId+winner} data-pot-winner={winner} data-pot-duration="1200" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i} data-pot-coin>●</i>)}</span>)}
 </div>
 <div className={styles.controls} aria-label="リングゲームのアクション">{legal?<><button type="button" disabled={disabled} onClick={()=>act({type:'fold'})}>フォールド</button>{legal.check?<button type="button" disabled={disabled} onClick={()=>act({type:'check'})}>チェック</button>:<button type="button" disabled={disabled||!legal.call} onClick={()=>act({type:'call'})}>コール {legal.callAmount.toLocaleString()}</button>}{legal.raise&&<><label>ベット合計<input type="number" inputMode="numeric" value={amount} min={legal.minRaiseTo!} max={legal.maxRaiseTo!} step="1" onChange={e=>setAmount(e.target.value)}/></label><button type="button" disabled={disabled||!valid} onClick={()=>act({type:'raise',amount:wager})}>{legal.shortAllInOnly?'オールイン':'ベット／レイズ'}</button><button type="button" disabled={disabled} onClick={()=>act({type:'raise',amount:legal.maxRaiseTo!})}>オールイン {legal.maxRaiseTo?.toLocaleString()}</button></>}</>:<p>{s.result?'精算完了 · 次のハンドを準備しています。':'他のプレイヤーの操作を待っています。'}</p>}</div>
 </div>;
}

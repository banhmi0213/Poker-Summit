'use client';
import {useEffect,useRef,useState} from 'react';
import {useSoundSettings} from '@/lib/poker/sound-settings';
import type {RingPlayView} from '@/lib/poker/ring-play-state';
import type {BettingAction} from '@/lib/poker/betting';
import type {RunsChoice} from '@/lib/poker/hand-command';
import {useTablePreferences} from './table-preferences';
import {ringWagerAction} from '@/lib/poker/ring-wager-action';
import {PokerSounds,boardSound} from '@/lib/poker/online-sounds';
import {SummitMark} from './brand-mark';
import {BettingControls} from './betting-controls';
import {useAutoAction} from './use-auto-action';
import {useRingRunout} from './use-ring-runout';
import {usePotFlight} from './use-pot-flight';
import {TableMotionLayer,useTableActionMotion} from './table-action-motion';
import styles from './ring-live-table.module.css';
import {OnlineTableView} from '@/app/poker-online/[roomId]/online-table-view';
import {ringTableDisplay} from '@/lib/poker/ring-table-display';
type Card=RingPlayView['hand']['board'][number];
function Cards({cards,motionHole,board=false}:{cards:Card[]|null;motionHole?:string;board?:boolean}){return <span className={styles.cards} data-motion-hole={motionHole} data-motion-board={board?true:undefined}>{(cards??[null,null]).map((c,i)=><span key={i} className={c?styles.card:styles.back} data-red={Boolean(c&&(c.suit==='h'||c.suit==='d'))}>{c?<>{({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[c.rank]??c.rank}{({c:'♣',d:'♦',h:'♥',s:'♠'})[c.suit]}</>:<SummitMark/>}</span>)}</span>;}
export default function RingLiveTable({seatExtra,onShow,shows,onStamp,stampDisabled,stamps,play:incoming,blocked,onAction,layout='simple',onExit,summary,footer,onTimeBank,onSpectate,onRefresh,onEmptySeat,emptySeatsDisabled,ringSeatStacks,capacity=6,onClock}:{seatExtra?:import('react').ReactNode;onClock?:()=>void;onShow?:(cards:'first'|'second'|'both')=>void;shows?:{seat:number;handId:string;cards:import('@/lib/poker/engine').Card[]}[];onStamp?:(stamp:import('@/lib/poker/stamps').StampId)=>void;stampDisabled?:boolean;stamps?:{seat:number;stamp:string;age?:number}[];capacity?:2|6;ringSeatStacks?:Record<number,number>;onEmptySeat?:(seat:number)=>void;emptySeatsDisabled?:boolean;onRefresh?:()=>void;onSpectate?:()=>void;onTimeBank?:()=>void;footer?:import('react').ReactNode;layout?:'simple'|'table';onExit?:()=>void;summary?:import('react').ReactNode;play:RingPlayView;blocked:boolean;onAction:(action:BettingAction|RunsChoice)=>void}){
 const play=useRingRunout(incoming);
 const s=play.hand,legal=s.legal,[amount,setAmount]=useState(''),[now,setNow]=useState(play.serverNow),[sound,setSound]=useSoundSettings(),muted=!sound.se,audio=useRef<PokerSounds|null>(null),last=useRef<{hand:string;revision:number;board:number;turn:string|null;won:boolean}|null>(null);
 const flight=usePotFlight(Boolean(s.result),s.handId);
 useTableActionMotion(flight,{handId:s.handId,revision:s.revision,boardCount:s.board.length,settled:Boolean(s.result),players:s.players.map(p=>({id:p.id,committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded}))});
 useEffect(()=>{const local=Date.now(),server=play.serverNow;setNow(server);const timer=setInterval(()=>setNow(server+Date.now()-local),100);return()=>clearInterval(timer);},[play.serverNow]);
 useEffect(()=>{const sound=new PokerSounds();audio.current=sound;const unlock=()=>void sound.unlock();document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);sound.close();audio.current=null;};},[]);
 useEffect(()=>{audio.current?.setEnabled(!muted);},[muted]);
 useEffect(()=>{const prior=last.current;if(!prior||prior.hand!==s.handId)audio.current?.play('deal');else if(!prior.won&&s.result)audio.current?.play('win');else if(prior.board!==s.board.length)audio.current?.play(boardSound(s.board.length)??'deal');else if(prior.revision!==s.revision)audio.current?.play('action');if(s.toAct===play.viewerSeat&&(!prior||prior.turn!==s.toAct||prior.revision!==s.revision))audio.current?.play('turn');last.current={hand:s.handId,revision:s.revision,board:s.board.length,turn:s.toAct,won:Boolean(s.result)};},[s.handId,s.revision,s.board.length,s.result,s.toAct,play.viewerSeat]);
 useEffect(()=>{setAmount(legal?.minRaiseTo===null||legal?.minRaiseTo===undefined?'':String(legal.minRaiseTo));},[s.handId,s.revision,legal?.minRaiseTo]);
 const seconds=play.deadline===null?0:Math.max(0,Math.ceil((play.deadline-now)/1000)),elapsed=play.deadline===null?100:Math.min(100,Math.max(0,100-(play.deadline-now)/((play.turnDurationMs??10000)/100))),disabled=blocked||play.hand.handId!==incoming.hand.handId||play.hand.revision!==incoming.hand.revision||play.deadline===null||now>=play.deadline;
 const wager=Number(amount),valid=legal?.raise&&Number.isSafeInteger(wager)&&wager>=legal.minRaiseTo!&&wager<=legal.maxRaiseTo!;
 const act=(action:BettingAction|RunsChoice)=>{void audio.current?.unlock().then(()=>audio.current?.play('action'));onAction(action);};
 const choosing=Boolean(s.runs&&s.runs.decided===null);
 const runsPanel=s.runs&&s.runs.decided===null?<RunsChoicePanel runs={s.runs} viewer={play.viewerSeat} spectating={Boolean(play.spectating)} seconds={seconds} blocked={blocked||play.hand.handId!==incoming.hand.handId||play.hand.revision!==incoming.hand.revision} handId={s.handId} onChoose={count=>act({type:'runs',count})}/>:null;
 const auto=useAutoAction(s.handId,s.revision,legal,disabled,act);
 const controls=choosing?runsPanel:<div className={styles.controls} aria-label="リングゲームのアクション"><button type="button" disabled={disabled||!legal||!play.timeBank?.remaining||!onTimeBank} onClick={onTimeBank}>◷ タイムバンク +20秒（残り{play.timeBank?.remaining??0}回）</button><button type="button" aria-pressed={auto.mode==='check'} disabled={blocked||Boolean(s.result)} onClick={()=>auto.toggle('check')}>オートチェック {auto.mode==='check'?'ON':'OFF'}</button><button type="button" aria-pressed={auto.mode==='fold'} disabled={blocked||Boolean(s.result)} onClick={()=>auto.toggle('fold')}>オートフォールド {auto.mode==='fold'?'ON':'OFF'}</button>{legal?<><button type="button" disabled={disabled} onClick={()=>act({type:'fold'})}>フォールド</button>{legal.check?<button type="button" disabled={disabled} onClick={()=>act({type:'check'})}>チェック</button>:<button type="button" disabled={disabled||!legal.call} onClick={()=>act({type:'call'})}>コール {legal.callAmount.toLocaleString()}</button>}{legal.raise&&<><label>ベット合計<input type="number" inputMode="numeric" value={amount} min={legal.minRaiseTo!} max={legal.maxRaiseTo!} step="1" onChange={e=>setAmount(e.target.value)}/></label><button type="button" disabled={disabled||!valid} onClick={()=>act(ringWagerAction(s,wager))}>{legal.shortAllInOnly?'オールイン':'ベット／レイズ'}</button><button type="button" disabled={disabled} onClick={()=>act(ringWagerAction(s,legal.maxRaiseTo!))}>オールイン {legal.maxRaiseTo?.toLocaleString()}</button></>}</>:<p>{s.result?'精算完了 · 次のハンドを準備しています。':'他のプレイヤーの操作を待っています。'}</p>}</div>;
 if(layout==='table')return <OnlineTableView seatExtra={seatExtra} onStampSound={()=>void audio.current?.unlock().then(()=>audio.current?.play('stamp'))} onShow={onShow} shows={shows} onStamp={onStamp} stampDisabled={stampDisabled} stamps={stamps} state={ringTableDisplay(play,now,capacity,ringSeatStacks)} ring onEmptySeat={onEmptySeat} emptySeatsDisabled={emptySeatsDisabled} ringSeatStacks={ringSeatStacks} ringSummary={summary} onExit={onExit} onSpectate={onSpectate} onRefresh={onRefresh} onClock={onClock} soundEnabled={!muted} onSoundToggle={enabled=>setSound({se:enabled})}>{play.spectating?choosing?runsPanel:<p role="status">{play.waiting?'席を確保しました · 次のハンドから自動参加します。':'観戦中 · 手札はショーダウン時に公開されます。'}</p>:play.sittingOut?null:(choosing?runsPanel:<BettingControls hand={s} blocked={disabled} seconds={play.deadline===null?null:seconds} turnMs={play.turnDurationMs??10000} bank={play.timeBank} onTimeBank={onTimeBank} onAction={act}/>)} {footer}</OnlineTableView>;
 return <div className={styles.game}><div className={styles.bar}><span>SB {s.terms.sb} / BB {s.terms.bb}</span><span role="status">{s.result?'勝敗確定':s.toAct?`${s.toAct===play.viewerSeat?'あなた':`プレイヤー ${s.toAct.slice(5)}`}の番 · ${seconds}秒`:'カード公開中'}</span><button type="button" onClick={()=>{void audio.current?.unlock();setSound({se:!sound.se});}}>SE {muted?'OFF':'ON'}</button></div>
 <div ref={flight} className={styles.felt} data-board-count={s.board.length} data-result={Boolean(s.result)}><TableMotionLayer/>
 <div className={styles.board}><small>{s.street.toUpperCase()}</small><div>{s.board.length?<Cards cards={s.board} board/>:<span className={styles.waiting}>COMMUNITY CARDS</span>}</div><strong data-pot-source>POT {s.pot.toLocaleString()} chip</strong></div>
 <div className={styles.seats} data-count={s.players.length}>{s.players.map(p=><section key={p.id} className={styles.player} data-folded={p.folded} data-own={p.id===play.viewerSeat} data-turn={p.id===s.toAct}>
 <div className={styles.avatar} data-pot-target={p.id} data-motion-stack={p.id}><SummitMark/>{p.id===s.toAct&&<svg viewBox="0 0 64 64" aria-label={`残り${seconds}秒`}><circle cx="32" cy="32" r="29" pathLength="100" strokeDasharray="100" strokeDashoffset={-elapsed}/></svg>}</div>
 <strong>プレイヤー {p.id.slice(5)}{!play.spectating&&p.id===play.viewerSeat?'（あなた）':''}</strong><div className={styles.positions}>{s.positions.button===p.id&&<span>BTN</span>}{s.positions.sb===p.id&&<span>SB</span>}{s.positions.bb===p.id&&<span>BB</span>}</div>
 <Cards cards={p.hole} motionHole={p.id}/><b>{p.stack.toLocaleString()} chip</b><small data-motion-bet={p.id}>{s.result?.payouts[p.id]?`獲得 +${s.result.payouts[p.id].toLocaleString()}`:p.folded?'フォールド':p.allIn?'オールイン':`ベット ${p.committed.toLocaleString()}`}</small></section>)}</div>
 {s.result?.winners.map(winner=><span className={styles.flight} key={s.handId+winner} data-pot-winner={winner} data-pot-duration="1200" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i} data-pot-coin>●</i>)}</span>)}
 </div>
 {controls}
 </div>;
}

/** All-in runout: each live player answers 1 or 2 runs. Two runs only when everyone answers 2; any 1 or the 8-second limit means once. */
function RunsChoicePanel({runs,viewer,spectating,seconds,blocked,handId,onChoose}:{runs:NonNullable<RingPlayView['hand']['runs']>;viewer:string;spectating:boolean;seconds:number;blocked:boolean;handId:string;onChoose:(count:1|2)=>void}){
 const {settings}=useTablePreferences(),sent=useRef<string|null>(null),mine=runs.choices[viewer];
 // A saved "always" answer is sent once per hand without asking.
 useEffect(()=>{if(!runs.canChoose||spectating||blocked||settings.runItTwice==='ask'||sent.current===handId)return;sent.current=handId;onChoose(settings.runItTwice==='twice'?2:1);},[runs.canChoose,spectating,blocked,settings.runItTwice,handId,onChoose]);
 const label=(id:string)=>id===viewer&&!spectating?'あなた':`プレイヤー ${id.slice(5)}`,answer=(c:1|2|null)=>c===null?'選択中':c===2?'2回':'1回';
 return <section className={styles.runsChoice} aria-label="ラン・イット・トゥワイス" role="group">
  <strong>オールイン · 残りのカードを何回配るか選んでください（{seconds}秒）</strong>
  <p>全員が「2回」を選んだときだけ2回配り、ポットを半分ずつ分けます。誰かが「1回」か時間切れなら1回です。</p>
  <ul>{runs.participants.map(id=><li key={id}>{label(id)}：{answer(runs.choices[id])}</li>)}</ul>
  {runs.canChoose&&!spectating?<div className={styles.runsButtons}><button type="button" disabled={blocked} onClick={()=>{sent.current=handId;onChoose(1);}}>1回</button><button type="button" disabled={blocked} onClick={()=>{sent.current=handId;onChoose(2);}}>2回</button></div>
   :!spectating&&mine?<p role="status">あなたは{answer(mine)}を選びました · ほかのプレイヤーを待っています</p>:null}
 </section>;
}

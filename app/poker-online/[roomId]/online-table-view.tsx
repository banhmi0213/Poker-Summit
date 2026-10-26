'use client';
import {CardFace} from '@/app/poker-ui/card-face';
import {PlayerAvatar} from '@/app/poker-ui/player-avatar';
import {useTableMembers} from '@/app/poker-ui/use-table-members';
import {TableGameMenu} from '@/app/poker-ui/table-game-menu';
import {useTablePreferences,formatTableChips} from '@/app/poker-ui/table-preferences';

import {TableMotionLayer,useTableActionMotion} from '@/app/poker-ui/table-action-motion';
import {usePotFlight} from '@/app/poker-ui/use-pot-flight';
import {onlineSoundEvents,type SoundMarker} from '@/lib/poker/sound-events';
import type {PokerSound} from '@/lib/poker/online-sounds';
import {resultPresentation} from '@/lib/poker/result-presentation';
import {SummitMark} from '@/app/poker-ui/brand-mark';
import {Children,isValidElement,useEffect,useRef,useState,type ReactNode} from 'react';
import type {PlayerSnapshot} from '@/lib/poker/player-client';
import {onlineTableSeats,onlineTurnSeconds} from '@/lib/poker/table-presentation';
import {cardLabel,isRedCard} from '@/lib/poker/card-display';
import type {Card} from '@/lib/poker/engine';
import shared from '../../poker-demo/poker-table.module.css';
import styles from './table.module.css';
function hasTableNotice(node:ReactNode):boolean{return Children.toArray(node).some(child=>isValidElement<{role?:string;children?:ReactNode}>(child)&&(child.props.role==='status'||hasTableNotice(child.props.children)));}
const streetLabels:Record<string,string>={preflop:'プリフロップ',flop:'フロップ',turn:'ターン',river:'リバー',showdown:'ショーダウン'};
const handKey=(state:PlayerSnapshot|null)=>state?.hand?.handId;
const names=(id:string)=>`プレイヤー ${id.replace('seat-','')}`;
const chips=(n:number|null)=>n===null?'開始待ち':n.toLocaleString();
function Hole({cards,small=false,motionHole}:{cards:readonly Card[]|null;small?:boolean;motionHole?:string}){
 return <div className={small?shared.miniCards:shared.hole} data-motion-hole={motionHole}>{cards?cards.map((c,i)=><span key={i} className={isRedCard(c)?shared.redCard:shared.blackCard}><CardFace card={c}/></span>):[0,1].map(i=><span key={i} className={shared.cardBack} aria-label="裏向きカード"><SummitMark className={shared.thumbLogo}/></span>)}</div>;
}
function Structure({state,onExit}:{state:PlayerSnapshot|null;onExit?:()=>void}){
 let level=0;
 return <><h2>ストラクチャー</h2>{state?.structure?<>
  <p>初期チップ {chips(state.structure.startingStack)}</p><p>アンティ：{state.structure.anteType==='bb'?'BBアンティ':state.structure.anteType==='per-player'?'全員アンティ':'なし'}</p>
  <div className={styles.structureScroll}><table><thead><tr><th>LV</th><th>SB / BB</th><th>Ante</th><th>分</th></tr></thead><tbody>{state.structure.periods.map((p,i)=><tr key={i} data-current={i===state.clock.index} aria-current={i===state.clock.index?'step':undefined}><td>{p.kind==='break'?'休憩':++level}</td><td>{p.kind==='break'?'—':`${chips(p.sb)} / ${chips(p.bb)}`}</td><td>{p.kind==='break'?'—':chips(p.ante)}</td><td>{p.minutes}</td></tr>)}</tbody></table></div>
  <p>ブラインド変更は次のハンドから適用します。休憩中も進行中のハンドは継続します。</p>
 </>:<p>接続後に大会の設定を表示します。</p>}<a href="/poker-lobby" onClick={event=>{if(onExit){event.preventDefault();onExit();}}}>ロビーへ戻る</a></>;
}
function ResultSummary({state,ring=false}:{state:PlayerSnapshot|null;ring?:boolean}){
 const {settings}=useTablePreferences();const amount=(n:number)=>formatTableChips(n,state?.hand?.terms.bb??0,settings.bb);
 const current=state?.hand?.result?{number:state.handNumber,winners:[...state.hand.result.winners],payouts:{...state.hand.result.payouts},deltas:onlineTableSeats(state).map(s=>({id:s.seat.id,delta:s.delta}))}:null;
 const [previous,setPrevious]=useState<typeof current>(null);
 useEffect(()=>{if(!state)setPrevious(null);else if(current)setPrevious(current);},[state]);
 // Store only already-public outcome totals; never retain hole cards or credentials.
 const result=state?(current??previous):null;
 return <div className={`${shared.resultOverlay} ${current?'':shared.previousResult}`} role="status"><strong>{result?`${ring?'ハンド結果':`ハンド ${result.number}`}${current?(ring?'':' 結果'):'（直前の結果）'}：${result.winners.map(id=>`${names(id)} がPOT獲得 ${amount(result.payouts[id]??0)}${settings.bb?'':' chip'}`).join('・')}`:'ハンド結果：確定待ち'}</strong><div className={`${shared.resultDeltas} ${styles.results}`}>{(result?.deltas??(state?onlineTableSeats(state).map(s=>({id:s.seat.id,delta:null})):[])).map(s=><span key={s.id} className={s.delta===null||s.delta===0?shared.resultEven:s.delta>0?shared.resultGain:shared.resultLoss}>{names(s.id)} <b>増減 {s.delta===null?'—':`${s.delta>0?'+':''}${amount(s.delta)}`}</b></span>)}</div></div>;
}
export function OnlineTableView({state:source,children,onExit,onSound,soundEnabled=true,onSoundToggle,ring=false,ringSummary,onEmptySeat,emptySeatsDisabled=false,ringSeatStacks,onSpectate,onRefresh}:{onRefresh?:()=>void;onSpectate?:()=>void;ringSeatStacks?:Record<number,number>;emptySeatsDisabled?:boolean;onEmptySeat?:(seat:number)=>void;ring?:boolean;ringSummary?:ReactNode;state:PlayerSnapshot|null;children?:ReactNode;onExit?:()=>void;onSound?:(kind:PokerSound)=>void;soundEnabled?:boolean;onSoundToggle?:(enabled:boolean)=>void}){
 const members=useTableMembers();
 const [animationNow,setAnimationNow]=useState<number|null>(null);
 useEffect(()=>{setAnimationNow(null);if(!source?.hand?.result||source.completedAt===null)return;
  const start=performance.now(),at=source.serverNow;
  if(resultPresentation(source,at).remainingMs<=0)return;
  const timer=setInterval(()=>{const now=at+performance.now()-start;setAnimationNow(now);if(resultPresentation(source,now).remainingMs<=0)clearInterval(timer);},80);return()=>clearInterval(timer);
 },[source?.hand?.handId,source?.completedAt,Boolean(source?.hand?.result)]);
 const frame=source?resultPresentation(source,Math.max(source.serverNow,animationNow??0)):null,state=frame?.state??null;
 const collecting=ring?Boolean(state?.hand?.result):Boolean(frame?.collecting);
 const tableRef=usePotFlight(collecting,handKey(source));
 const soundMarker=useRef<SoundMarker|null>(null);
 const [announcement,setAnnouncement]=useState<{kind:string;text:string;key:number}|null>(null);
 useEffect(()=>{if(!announcement)return;const id=setTimeout(()=>setAnnouncement(null),2600);return()=>clearTimeout(id);},[announcement]);
 useEffect(()=>{const next=onlineSoundEvents(soundMarker.current,state);soundMarker.current=next.marker;if(next.cue){const c=next.cue;setAnnouncement({kind:c.kind,text:`${names(c.actor)} · ${c.label}${c.amount?` ${c.amount.toLocaleString()}`:""}`,key:Date.now()});}for(const kind of next.sounds)onSound?.(kind);},[state?.hand?.handId,state?.hand?.revision,state?.hand?.board.length,state?.hand?.toAct,Boolean(state?.hand?.result),state?.youSeat,onSound]);
 const [menu,setMenu]=useState(false),hand=state?.hand,revealOpponents=Boolean(hand&&(hand.result?.showdown||(hand as {runs?:unknown}).runs||(!hand.result&&hand.toAct===null&&hand.players?.some(p=>p.allIn&&!p.folded)))),seats=state?onlineTableSeats(state,Boolean(onEmptySeat),ring&&state.youSeat===null):[],seconds=state?onlineTurnSeconds(state):null;
 useTableActionMotion(tableRef,hand?{handId:hand.handId,revision:hand.revision,boardCount:hand.board.length,settled:Boolean(hand.result),players:hand.players.map(p=>({id:p.id,committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded}))}:null);
 const seatClasses={p2:shared.topSeats,p3:shared.edgeSeatThree,p4:shared.edgeSeatFour,p5:shared.edgeSeatFive,p6:shared.edgeSeatSix,you:shared.self};
 const cardClasses={p2:shared.showdownTwo,p3:shared.showdownThree,p4:shared.showdownFour,p5:shared.showdownFive,p6:shared.showdownSix,you:''};
 const {settings}=useTablePreferences(),showAmount=(value:number|null)=>formatTableChips(value,hand?.terms.bb??0,settings.bb);
 const ringBlinds=hand?.terms??(state?.clock.period?.kind==='level'?state.clock.period:null);
 const street=hand?.street==='preflop'?0:hand?.street==='flop'?1:hand?.street==='turn'?2:3;
 const next=state?.phase==='finished'?null:state?.clock.following,clockText=!state?'未接続':state.phase==='finished'?'大会終了':state.clock.phase==='final'?'最終レベル継続':`${Math.floor(state.clock.remaining/60).toString().padStart(2,'0')}:${(state.clock.remaining%60).toString().padStart(2,'0')}`;
 const exit=onExit?<button type="button" className={shared.topExit} aria-label="ゲームを退出" onClick={onExit}>↪</button>:<a className={shared.topExit} aria-label="ゲームを退出" href="/poker-lobby">↪</a>;
 return <section className={`${shared.shell} ${styles.compactShell}`} aria-label="オンラインポーカーテーブル">
  <div className={`${shared.heading} ${styles.onlineHeading}`}><button type="button" className={shared.menuToggle} aria-label="ゲームメニューを開く" aria-expanded={menu} aria-controls="online-game-menu" onClick={()=>setMenu(v=>!v)}>☰</button><span>POKER SUMMIT · TEXAS HOLD'EM</span>{exit}</div>
  {menu&&<div className={shared.menuBackdrop} aria-hidden="true" onClick={()=>setMenu(false)}/>}
  <div id="online-game-menu" className={shared.menuPanel} hidden={!menu}><TableGameMenu deferredSpectate={ring} onRefresh={onRefresh} onClose={()=>setMenu(false)} onExit={onExit} onSpectate={onSpectate} soundEnabled={soundEnabled} onSoundToggle={onSoundToggle} information={ring?<><p>会員チップで対戦中 · チップは退出時に返却</p><p>3回連続の時間切れでシットアウト。ブラインドを支払いながら自動フォールドし、3分または5ハンドで精算後に自動退出します。復帰ボタンで解除できます。</p>{ringSummary}</>:<Structure state={state} onExit={onExit}/>}/></div>
  <aside className={`${shared.desktopStructure} ${styles.leftRail}`} aria-label={ring?'リング卓情報':'大会ストラクチャー'}><details className={shared.infoDrawer}><summary>卓の情報<span className={shared.infoNotice} role="img" aria-label="卓からのお知らせがあります" hidden={!hasTableNotice(ringSummary)&&!hasTableNotice(children)}/></summary><div className={shared.infoBody}>{ring?<><h2>リングゲーム</h2>{ringSummary}<p>ハンド中の退出は精算後にチップを返却します。</p></>:<Structure state={state} onExit={onExit}/>}<div id="poker-community-slot" className={styles.communitySlot}/></div></details></aside>
  <div className={`${shared.gameClock} ${styles.onlineClock}`}>{ring?<aside className={styles.clock}><div><strong>リングゲーム</strong><b>SB {chips(ringBlinds?.sb??0)} / BB {chips(ringBlinds?.bb??0)}</b><p>アンティなし · 持ち時間20秒</p></div></aside>:<aside className={styles.clock}><div><strong>{!state?'オンライン対戦':state.phase==='finished'?'大会終了':state.clock.phase==='scheduled'?'開始待ち':state.clock.phase==='break'?'休憩中':state.phase==='waiting'&&state.seats.filter(s=>s.occupied).length<2?'着席者不足':'トーナメント'}</strong><div><span>LEVEL {state?.clock.level??'—'}</span><b>{clockText}</b></div><p>現在のハンド：{hand?`SB ${chips(hand.terms.sb)} / BB ${chips(hand.terms.bb)} · Ante ${chips(hand.terms.ante)}`:'開始待ち'}</p><small>{next?next.kind==='break'?`次：休憩 ${next.minutes}分`:`次ブラインド：${chips(next.sb)} / ${chips(next.bb)} · Ante ${chips(next.ante)}`:state?.phase==='finished'?'ブラインドタイマー停止':state?'次のレベルはありません':'接続を待っています'}</small></div></aside>}</div>
  <div className={`${shared.statusDock} ${styles.statusDock}`} hidden={ring}>{ring?null:<details className={shared.tournamentStatus}><summary>大会情報{state?.tournament?` · 残り ${state.tournament.liveIds.length}人`:''}</summary><p>ハンド {state?.handNumber??0}</p>{state?.tournament?.eliminated.map(e=><p key={e.id}>{e.place===e.tiedThrough?`${e.place}位`:`${e.place}〜${e.tiedThrough}位` }：{names(e.id)}</p>)}<p>再接続してもチップと進行状況は維持されます。</p></details>}</div>
  <div ref={tableRef} className={`${shared.table} ${styles.onlineFelt}`} data-hand-revision={hand?.revision??-1} data-board-count={hand?.board.length??0} data-result={Boolean(hand?.result)} data-street={street} data-showdown={Boolean(hand?.result?.showdown)} aria-label="サーバーのテーブル状態"><TableMotionLayer/>
   {seats.map(({seat,slot,player,isYou,stack,positions,payout})=><div key={seat.id} className={seatClasses[slot]} data-seat={seat.seat} data-slot={slot}>
    <div className={`${shared.seat} ${hand?.toAct===seat.id?shared.seatActive:''} ${payout>0?shared.winnerSeat:''} ${player?.folded?shared.inactiveSeat:''}`}>
     <div className={shared.seatAvatarRow}><div className={shared.seatTimerRing} role={hand?.toAct===seat.id?'progressbar':undefined} aria-label={hand?.toAct===seat.id?`${names(seat.id)}の持ち時間`:undefined} aria-valuemin={hand?.toAct===seat.id?0:undefined} aria-valuemax={hand?.toAct===seat.id?Math.ceil((state?.turnDurationMs??20000)/1000):undefined} aria-valuenow={hand?.toAct===seat.id?seconds??0:undefined} style={hand?.toAct===seat.id?{background:`conic-gradient(from 0deg, #42586c ${100-Math.max(0,Math.min(100,((state?.turn?.expiresAt??0)-(state?.serverNow??0))/(state?.turnDurationMs??20000)*100))}%, ${(seconds??0)<=5?'#f05b58':'#f3c663'} 0)`}:undefined}><div data-pot-target={slot} data-motion-stack={seat.id} className={shared.avatar}><PlayerAvatar url={members[seat.seat]?.avatarUrl} name={members[seat.seat]?.displayName??names(seat.id)} className={shared.memberAvatarImage}/></div></div>{!ring&&<span className={styles.connectionDot} data-connected={seat.connected} aria-label={seat.connected?'接続中':'未接続'} title={seat.connected?'接続中':'未接続'}/>}{positions&&<span className={`${shared.seatPositionBadge} ${styles.positionBadge}`} style={slot==='you'||slot==='p2'?{top:12,left:'auto',right:'calc(100% + 6px)',transform:'none'}:{top:-18,left:'50%',right:'auto',transform:'translateX(-50%)'}}>{positions}</span>}</div>
     <span>{!seat.occupied&&onEmptySeat?<button type="button" aria-label={`席 ${seat.seat} に着席`} disabled={emptySeatsDisabled} onClick={()=>onEmptySeat(seat.seat)} style={{fontSize:26,minWidth:44,minHeight:44}}>＋</button>:members[seat.seat]?.displayName??names(seat.id)}{isYou?'（あなた）':''}</span><small>{seat.occupied?`チップ ${showAmount(stack??ringSeatStacks?.[seat.seat]??null)}`:null}</small>
     {player?.folded?<span className={shared.actionBadge}>フォールド</span>:player?.allIn?<span className={shared.actionBadge}>オールイン</span>:hand?.toAct===seat.id?<span className={shared.actionBadge}>思考中{seconds!==null?` ${seconds}秒`:''}</span>:null}
    </div>
    {slot==='you'&&player&&!player.folded&&<div className={shared.handWithRank}><Hole cards={player.hole} motionHole={seat.id}/></div>}
   </div>)}
   <div className={shared.opponentCardsLayer} aria-label="各プレイヤーのハンド">{seats.filter(s=>s.slot!=='you'&&s.player&&!s.player.folded).map(s=><div key={s.seat.id} className={`${shared.showdownPosition} ${cardClasses[s.slot]} ${s.slot==='p5'||s.slot==='p6'?styles.lowerCards:''}`}><Hole cards={revealOpponents?s.player!.hole:null} motionHole={s.seat.id} small/></div>)}</div>
   <div className={shared.streetBets} aria-label="各席のベット額">{seats.filter(s=>s.committed>0).map(s=><div key={s.seat.id} data-motion-bet={s.seat.id} className={`${shared.streetBet} ${shared[`bet_${s.slot}`]} ${s.slot==='p2'?styles.topBet:''}`} aria-label={`${names(s.seat.id)}：ベット ${s.committed}`}><span className={shared.betChip} aria-hidden="true">♠</span><span>{street===0&&hand?.positions.sb===s.seat.id?'SB ':street===0&&hand?.positions.bb===s.seat.id?'BB ':''}{showAmount(s.committed)}</span></div>)}</div>
   {collecting&&seats.filter(s=>s.payout>0).map(s=><div key={`${hand!.handId}-${s.seat.id}`} className={styles.payoutFlight} data-pot-winner={s.slot} data-pot-duration="800" data-slot={s.slot} aria-label={`${names(s.seat.id)}へPOT ${showAmount(s.payout)}を移動`}>{[0,1,2,3,4].map(i=><i data-pot-coin key={i} style={{animationDelay:`${i*70}ms`}}>♠</i>)}</div>)}
   {announcement&&<div key={announcement.key} className={shared.actionToast} data-kind={announcement.kind} role="status" aria-live="polite">{announcement.text}</div>}
   <div className={shared.felt}><div data-pot-source className={shared.pot}>POT <strong>{showAmount(hand?.pot??0)}</strong></div>{(()=>{const runBoards=(hand as {runBoards?:typeof hand.board[]}|null)?.runBoards??hand?.result?.boards;return runBoards?<div className={styles.runBoards} aria-label="共通カード（2回）">{runBoards.map((b,r)=><div key={r} className={styles.runRow}><small>{r+1}回目</small><div className={`${shared.cards} ${styles.communityCards}`} aria-label={`共通カード ${r+1}回目`} data-motion-board={r===0?true:undefined}>{b.map((c,i)=><span key={i} className={isRedCard(c)?shared.red:''}><CardFace card={c}/></span>)}</div></div>)}</div>:<div className={`${shared.cards} ${styles.communityCards}`} aria-label="共通カード" data-motion-board>{hand?.board.map((c,i)=><span key={i} className={isRedCard(c)?shared.red:''}><CardFace card={c}/></span>)}</div>;})()}<div className={shared.street}>{hand?`${streetLabels[hand.street]??hand.street}${ring?'':` · ハンド ${state?.handNumber}`}`:'参加者の接続を待っています'}</div></div>
  </div>
  <div className={`${shared.actionColumn} ${styles.onlineActions}`}>
   <ResultSummary state={state} ring={ring}/>
   {state?.phase==='finished'&&<div className={shared.spectatorPanel} role="status">大会終了 · 優勝 {state.tournament?.champion?names(state.tournament.champion):'確定待ち'}<p>結果は保存されます。終了から10分でロビーへ戻ります。</p>{onExit?<button type="button" onClick={onExit}>退出する</button>:<a href="/poker-lobby">退出する</a>}</div>}
   {children}
  </div>
 </section>;
}

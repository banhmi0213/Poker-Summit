'use client';
import {SummitMark} from '@/app/poker-ui/brand-mark';
import {useEffect,useState,type ReactNode} from 'react';
import type {PlayerSnapshot} from '@/lib/poker/player-client';
import {onlineTableSeats,onlineTurnSeconds} from '@/lib/poker/table-presentation';
import {cardLabel,isRedCard} from '@/lib/poker/card-display';
import type {Card} from '@/lib/poker/engine';
import shared from '../../poker-demo/poker-table.module.css';
import styles from './table.module.css';
const streetLabels:Record<string,string>={preflop:'プリフロップ',flop:'フロップ',turn:'ターン',river:'リバー',showdown:'ショーダウン'};
const names=(id:string)=>`プレイヤー ${id.replace('seat-','')}`;
const chips=(n:number|null)=>n===null?'開始待ち':n.toLocaleString();
function Hole({cards,small=false}:{cards:readonly Card[]|null;small?:boolean}){
 return <div className={small?shared.miniCards:shared.hole}>{cards?cards.map((c,i)=><span key={i} className={isRedCard(c)?shared.redCard:shared.blackCard}>{cardLabel(c)}</span>):[0,1].map(i=><span key={i} className={shared.cardBack} aria-label="裏向きカード"><SummitMark className={shared.thumbLogo}/></span>)}</div>;
}
function Structure({state}:{state:PlayerSnapshot|null}){
 let level=0;
 return <><h2>ストラクチャー</h2>{state?.structure?<>
  <p>初期チップ {chips(state.structure.startingStack)}</p><p>アンティ：{state.structure.anteType==='bb'?'BBアンティ':state.structure.anteType==='per-player'?'全員アンティ':'なし'}</p>
  <div className={styles.structureScroll}><table><thead><tr><th>LV</th><th>SB / BB</th><th>Ante</th><th>分</th></tr></thead><tbody>{state.structure.periods.map((p,i)=><tr key={i} data-current={i===state.clock.index} aria-current={i===state.clock.index?'step':undefined}><td>{p.kind==='break'?'休憩':++level}</td><td>{p.kind==='break'?'—':`${chips(p.sb)} / ${chips(p.bb)}`}</td><td>{p.kind==='break'?'—':chips(p.ante)}</td><td>{p.minutes}</td></tr>)}</tbody></table></div>
  <p>ブラインド変更は次のハンドから適用します。休憩中も進行中のハンドは継続します。</p>
 </>:<p>接続後に大会の設定を表示します。</p>}<a href="/poker-lobby">ロビーへ戻る</a></>;
}
function ResultSummary({state}:{state:PlayerSnapshot|null}){
 const current=state?.hand?.result?{number:state.handNumber,winners:[...state.hand.result.winners],deltas:onlineTableSeats(state).map(s=>({id:s.seat.id,delta:s.delta}))}:null;
 const [previous,setPrevious]=useState<typeof current>(null);
 useEffect(()=>{if(!state)setPrevious(null);else if(current)setPrevious(current);},[state]);
 // Store only already-public outcome totals; never retain hole cards or credentials.
 const result=state?(current??previous):null;
 return <div className={`${shared.resultOverlay} ${current?'':shared.previousResult}`} role="status"><strong>{result?`ハンド ${result.number}${current?' 結果':'（直前の結果）'}：${result.winners.map(names).join('・')} がPOT獲得`:'ハンド結果：確定待ち'}</strong><div className={`${shared.resultDeltas} ${styles.results}`}>{(result?.deltas??(state?onlineTableSeats(state).map(s=>({id:s.seat.id,delta:null})):[])).map(s=><span key={s.id} className={s.delta===null||s.delta===0?shared.resultEven:s.delta>0?shared.resultGain:shared.resultLoss}>{names(s.id)} <b>増減 {s.delta===null?'—':`${s.delta>0?'+':''}${chips(s.delta)}`}</b></span>)}</div></div>;
}
export function OnlineTableView({state,children,onExit}:{state:PlayerSnapshot|null;children?:ReactNode;onExit?:()=>void}){
 const [menu,setMenu]=useState(false),hand=state?.hand,seats=state?onlineTableSeats(state):[],seconds=state?onlineTurnSeconds(state):null;
 const seatClasses={p2:shared.topSeats,p3:shared.edgeSeatThree,p4:shared.edgeSeatFour,p5:shared.edgeSeatFive,p6:shared.edgeSeatSix,you:shared.self};
 const cardClasses={p2:shared.showdownTwo,p3:shared.showdownThree,p4:shared.showdownFour,p5:shared.showdownFive,p6:shared.showdownSix,you:''};
 const street=hand?.street==='preflop'?0:hand?.street==='flop'?1:hand?.street==='turn'?2:3;
 const next=state?.clock.following,clockText=!state?'未接続':state.clock.phase==='final'?'最終レベル継続':`${Math.floor(state.clock.remaining/60).toString().padStart(2,'0')}:${(state.clock.remaining%60).toString().padStart(2,'0')}`;
 const exit=onExit?<button type="button" className={shared.topExit} aria-label="ゲームを退出" onClick={onExit}>↪</button>:<a className={shared.topExit} aria-label="ゲームを退出" href="/poker-lobby">↪</a>;
 return <section className={shared.shell} aria-label="オンラインポーカーテーブル">
  <div className={shared.heading}><button type="button" className={shared.menuToggle} aria-label="ゲームメニューを開く" aria-expanded={menu} aria-controls="online-game-menu" onClick={()=>setMenu(v=>!v)}>☰</button><span>POKER SUMMIT · TEXAS HOLD'EM</span>{exit}</div>
  {menu&&<div className={shared.menuBackdrop} aria-hidden="true" onClick={()=>setMenu(false)}/>}
  <div id="online-game-menu" className={shared.menuPanel} hidden={!menu}><div className={shared.menuTop}><strong>ゲームメニュー</strong><button type="button" aria-label="メニューを閉じる" onClick={()=>setMenu(false)}>×</button></div><Structure state={state}/></div>
  <aside className={shared.desktopStructure} aria-label="大会ストラクチャー"><Structure state={state}/></aside>
  <div className={shared.gameClock}><aside className={styles.clock}><div><strong>{!state?'オンライン対戦':state.clock.phase==='scheduled'?'開始待ち':state.clock.phase==='break'?'休憩中':'トーナメント'}</strong><div><span>LEVEL {state?.clock.level??'—'}</span><b>{clockText}</b></div><p>現在のハンド：{hand?`SB ${chips(hand.terms.sb)} / BB ${chips(hand.terms.bb)} · Ante ${chips(hand.terms.ante)}`:'開始待ち'}</p><small>{next?next.kind==='break'?`次：休憩 ${next.minutes}分`:`次ブラインド：${chips(next.sb)} / ${chips(next.bb)} · Ante ${chips(next.ante)}`:state?'次のレベルはありません':'接続を待っています'}</small></div></aside></div>
  <div className={`${shared.statusDock} ${styles.statusDock}`}><details className={shared.tournamentStatus}><summary>大会情報{state?.tournament?` · 残り ${state.tournament.liveIds.length}人`:''}</summary><p>ハンド {state?.handNumber??0}</p>{state?.tournament?.eliminated.map(e=><p key={e.id}>{e.place===e.tiedThrough?`${e.place}位`:`${e.place}〜${e.tiedThrough}位` }：{names(e.id)}</p>)}<p>再接続してもチップと進行状況は維持されます。</p></details></div>
  <div className={shared.table} data-street={street} data-showdown={Boolean(hand?.result?.showdown)} aria-label="サーバーのテーブル状態">
   {seats.map(({seat,slot,player,isYou,stack,positions,payout})=><div key={seat.id} className={seatClasses[slot]} data-seat={seat.seat} data-slot={slot}>
    <div className={`${shared.seat} ${hand?.toAct===seat.id?shared.seatActive:''} ${payout>0?shared.winnerSeat:''} ${player?.folded?shared.inactiveSeat:''}`}>
     <div className={shared.seatAvatarRow}><div className={shared.seatTimerRing} role={hand?.toAct===seat.id?'progressbar':undefined} aria-label={hand?.toAct===seat.id?`${names(seat.id)}の持ち時間`:undefined} aria-valuemin={hand?.toAct===seat.id?0:undefined} aria-valuemax={hand?.toAct===seat.id?Math.ceil((state?.turnDurationMs??20000)/1000):undefined} aria-valuenow={hand?.toAct===seat.id?seconds??0:undefined} style={hand?.toAct===seat.id?{background:`conic-gradient(from 0deg, #42586c ${100-Math.max(0,Math.min(100,((state?.turn?.expiresAt??0)-(state?.serverNow??0))/(state?.turnDurationMs??20000)*100))}%, ${(seconds??0)<=5?'#f05b58':'#f3c663'} 0)`}:undefined}><div className={shared.avatar}>{seat.seat}</div></div><span className={styles.connectionDot} data-connected={seat.connected} aria-label={seat.connected?'接続中':'未接続'} title={seat.connected?'接続中':'未接続'}/>{positions&&<span className={`${shared.seatPositionBadge} ${styles.positionBadge}`} style={slot==='you'||slot==='p2'?{top:12,left:'auto',right:'calc(100% + 6px)',transform:'none'}:{top:-18,left:'50%',right:'auto',transform:'translateX(-50%)'}}>{positions}</span>}</div>
     <span>{names(seat.id)}{isYou?'（あなた）':''}</span><small>チップ {chips(stack)}</small>
     {player?.folded?<span className={shared.actionBadge}>フォールド</span>:player?.allIn?<span className={shared.actionBadge}>オールイン</span>:hand?.toAct===seat.id?<span className={shared.actionBadge}>思考中{seconds!==null?` ${seconds}秒`:''}</span>:null}
    </div>
    {slot==='you'&&player&&!player.folded&&<div className={shared.handWithRank}><Hole cards={player.hole}/></div>}
   </div>)}
   <div className={shared.opponentCardsLayer} aria-label="各プレイヤーのハンド">{seats.filter(s=>s.slot!=='you'&&s.player&&!s.player.folded).map(s=><div key={s.seat.id} className={`${shared.showdownPosition} ${cardClasses[s.slot]} ${s.slot==='p5'||s.slot==='p6'?styles.lowerCards:''}`} style={s.slot==='p2'?{left:'calc(50% + 44px)'}:s.slot==='p3'||s.slot==='p5'?{left:'calc(-2% + 72px)'}:{right:'calc(-2% + 72px)'}}><Hole cards={s.player!.hole} small/></div>)}</div>
   <div className={shared.streetBets} aria-label="各席のベット額">{seats.filter(s=>s.committed>0).map(s=><div key={s.seat.id} className={`${shared.streetBet} ${shared[`bet_${s.slot}`]} ${s.slot==='p2'?styles.topBet:''}`} aria-label={`${names(s.seat.id)}：ベット ${s.committed}`}><span className={shared.betChip} aria-hidden="true">♠</span><span>{street===0&&hand?.positions.sb===s.seat.id?'SB ':street===0&&hand?.positions.bb===s.seat.id?'BB ':''}{chips(s.committed)}</span></div>)}</div>
   <div className={shared.felt}><div className={shared.pot}>POT <strong>{chips(hand?.pot??0)}</strong></div><div className={`${shared.cards} ${styles.communityCards}`} aria-label="共通カード">{hand?.board.map((c,i)=><span key={i} className={isRedCard(c)?shared.red:''}>{cardLabel(c)}</span>)}</div><div className={shared.street}>{hand?`${streetLabels[hand.street]??hand.street} · ハンド ${state?.handNumber}`:'参加者の接続を待っています'}</div></div>
  </div>
  <div className={shared.actionColumn}>
   <ResultSummary state={state}/>
   {state?.phase==='finished'&&<div className={shared.spectatorPanel} role="status">大会終了 · 優勝 {state.tournament?.champion?names(state.tournament.champion):'確定待ち'}{onExit?<button type="button" onClick={onExit}>退出する</button>:<a href="/poker-lobby">退出する</a>}</div>}
   {children}
  </div>
 </section>;
}

'use client';

import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {SummitChipBalance} from '@/app/poker-ui/chip-balance';
import RingAdmissionPanel from '@/app/poker-ui/ring-admission-panel';
import {SkinSettings} from '@/app/poker-ui/skin-settings';
import {TablePreferences,useTablePreferences} from '@/app/poker-ui/table-preferences';
import {SKINS_FREE_FOR_NOW} from '@/lib/poker/skins';
import type {RingTable} from '@/lib/poker/ring-tables';
import type {RingLobbyState} from '@/lib/poker/ring-admission';
import {LobbyIcon,type LobbyIconName} from './lobby-icon';
import {RingLobbyList} from './ring-lobby-list';
import PokerLobbyPreview from './poker-lobby-preview';
import styles from './lobby-dashboard.module.css';

type PageId='lobby'|'assigned'|'tournaments'|'ranking'|'champions'|'skins';
type GameTab='ring'|'tournament'|'practice';
type TournamentCard={id:string;title:string;starts_at:string;image_url:string|null};
type Props={guest:boolean;admin:boolean;memberName:string;ringEnabled:boolean;tournamentsEnabled:boolean;rings:RingTable[];ringError:boolean;tournaments:TournamentCard[];assigned:ReactNode;registration:ReactNode;board:ReactNode};
const formatDate=(value:string)=>new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});

function SkinPicker(){const {save,status}=useTablePreferences();return <><p className={styles.lead}>{SKINS_FREE_FOR_NOW?'卓・カードの着せ替えは、現在すべて無料で選べます。':'交換済みの卓・カードの着せ替えを選べます。'}選んだデザインを保存すると、ゲーム画面に反映されます。</p><div className={styles.skinPicker}><SkinSettings/></div><div className={styles.paneActions}><button type="button" className={styles.goldButton} onClick={()=>void save()}>着せ替えを保存</button><Link href="/mypage/chips" className={styles.outlineButton}>チップ交換所</Link><span role="status">{status}</span></div></>;}

function RecordPlaceholder({kind,expanded=false}:{kind:'ranking'|'champions';expanded?:boolean}){
 const ranking=kind==='ranking';
 return <div className={styles.recordPlaceholder}>
  <div className={styles.recordSkeleton} aria-hidden="true">{[1,2,3].map(n=><div key={n}><span className={styles.medal} data-place={n}>{ranking?n:<LobbyIcon name="trophy"/>}</span><span className={styles.avatarGhost}/><span className={styles.nameGhost}/><span className={styles.valueGhost}/></div>)}</div>
  <p>{ranking?'ランキングは公開準備中です。':'優勝者一覧は公開準備中です。'}</p>
  {expanded&&<p className={styles.lead}>{ranking?'会員全体の持ちチップランキングは、公開用の集計が接続されてから表示します。自分の残高と順位は上部で確認できます。':'大会結果が確定し、公開用の記録が接続されてから優勝者を表示します。練習卓の結果は含みません。'}</p>}
 </div>;
}

export default function LobbyDashboard({guest,admin,memberName,ringEnabled,tournamentsEnabled,rings,ringError,tournaments,assigned,registration,board}:Props){
 const router=useRouter();
 const [active,setActive]=useState<PageId>('lobby'),[gameTab,setGameTab]=useState<GameTab>('ring'),[menuOpen,setMenuOpen]=useState(false),[ringState,setRingState]=useState<RingLobbyState|null>(null);
 const go=(id:PageId)=>{setActive(id);setMenuOpen(false);};
 const navigation:{id:PageId;label:string;icon:LobbyIconName}[]=[{id:'lobby',label:'ロビー',icon:'home'},{id:'assigned',label:'参加中の卓',icon:'people'},...(tournamentsEnabled?[{id:'tournaments' as const,label:'トーナメント',icon:'trophy' as const}]:[]),{id:'ranking',label:'持ちチップランキング',icon:'chart'},{id:'champions',label:'歴代大会優勝者',icon:'trophy'},{id:'skins',label:'着せ替え交換',icon:'cards'}];
 const title=navigation.find(item=>item.id===active)?.label??'ポーカーロビー';
 const upcoming=tournaments.filter(t=>Date.parse(t.starts_at)>Date.now()).slice(0,2);
 const configured=rings.map(t=>({id:t.id,title:t.title,sb:t.sb,bb:t.bb,capacity:t.capacity,minBuyIn:t.min_buy_in,maxBuyIn:t.max_buy_in,occupied:null}));
 const own=ringState?.membership;
 return <div className={styles.shell}>
  <header className={styles.header}><Link href="/poker-lobby" className={styles.brand}><img src="/images/logo.png" alt="Poker Summit" width="252" height="84"/></Link><nav aria-label="ポーカーナビゲーション"><Link href="/mypage/poker">プレイヤーページ</Link><Link href="/mypage">マイページ</Link><Link href="/">サイトトップ</Link>{admin&&<Link href="/admin/poker-statistics">総合管理</Link>}<span className={styles.memberAvatar} aria-label={guest?'ゲスト':memberName}><LobbyIcon name="people"/></span></nav></header>
  <div className={styles.layout}>
   <aside className={styles.sidebar}><div className={styles.sidebarTitle}><LobbyIcon name="finger"/><strong>ポーカーロビー</strong></div><button type="button" className={styles.menuToggle} aria-expanded={menuOpen} aria-controls="lobby-navigation" onClick={()=>setMenuOpen(v=>!v)}>ロビーメニュー<span aria-hidden="true">{menuOpen?'−':'＋'}</span></button><nav id="lobby-navigation" className={styles.navigation} data-open={menuOpen} aria-label="ロビー内のメニュー">{navigation.map(item=><button type="button" key={item.id} aria-pressed={active===item.id} onClick={()=>go(item.id)}><LobbyIcon name={item.icon}/><span>{item.label}</span></button>)}</nav><div className={styles.sidebarFoot}><Link href="/news"><LobbyIcon name="bell"/>お知らせ</Link><Link href="/mypage/poker"><LobbyIcon name="settings"/>プレイヤーページ・設定</Link>{guest&&<Link href="/login" className={styles.loginLink}>ログインする</Link>}</div></aside>
   <main className={styles.main}>
    <div className={styles.pageHeading}><h1>{active==='lobby'?'ポーカーロビー':title}</h1><p>{active==='lobby'?'遊ぶ卓も、次の目標も、ここから。':'あなたのポーカーを、もっと楽しく。'}</p>{guest&&<span className={styles.guestBadge}>ゲストプレビュー</span>}</div>
    <div className={styles.summaryGrid}>
     <div className={styles.summaryCard}><img className={styles.chipArt} src="/images/poker-lobby/chip-stacks-finger.webp" alt="" width="100" height="100"/>{guest?<div className={styles.guestBalance}><span>あなたの持ちチップ</span><strong>— <small>chip</small></strong><Link href="/login">ログインして残高を確認</Link></div>:<SummitChipBalance presentation="lobby"/>}</div>
     <div className={`${styles.summaryCard} ${styles.tableSummary}`}><LobbyIcon className={styles.peopleArt} name="people"/><div><h2>参加中の卓</h2><strong className={styles.tableCount}>{ringState?own?'1':'0':'—'}<small>卓</small></strong><button type="button" className={styles.goldButton} onClick={()=>go('assigned')}>参加卓を開く</button></div></div>
     <div className={`${styles.summaryCard} ${styles.skinSummary}`}><img className={styles.cardArt} src="/images/skins/back-onyx/back.svg" alt="" width="58" height="82"/><div><h2>着せ替え交換</h2><p>{SKINS_FREE_FOR_NOW?'現在は無料で選択できます':'チップで交換'}</p><button type="button" className={styles.goldButton} onClick={()=>go('skins')}>着せ替えを見る</button></div><span className={styles.tableArt} aria-hidden="true"><img src="/images/skins/standard/table-thumb.png" alt="" width="130" height="74"/><img className={styles.tableWordmark} src="/images/logo.png" alt="" width="800" height="267"/></span></div>
    </div>
    <div className={styles.contentGrid}>
     <div className={styles.center}>
      {active==='lobby'?<>
       <section className={styles.gamePanel} aria-label="参加する卓を探す">
        <div className={styles.tabs} role="tablist" aria-label="ゲーム形式"><button type="button" id="lobby-ring-tab" role="tab" aria-selected={gameTab==='ring'} aria-controls="lobby-game-panel" onClick={()=>setGameTab('ring')}>リングゲーム</button>{tournamentsEnabled&&<button type="button" id="lobby-tournament-tab" role="tab" aria-selected={gameTab==='tournament'} aria-controls="lobby-game-panel" onClick={()=>setGameTab('tournament')}>トーナメント</button>}<button type="button" id="lobby-practice-tab" role="tab" aria-selected={gameTab==='practice'} aria-controls="lobby-game-panel" onClick={()=>setGameTab('practice')}>練習卓</button></div>
        <div id="lobby-game-panel" role="tabpanel" aria-labelledby={`lobby-${gameTab}-tab`} className={styles.gameContent}>
         {gameTab==='ring'?!guest&&ringEnabled?<RingAdmissionPanel enabled productionFlow lobbyLayout="list" onLobbyState={setRingState}/>:<><RingLobbyList rows={configured} unavailable={ringError} onRefresh={()=>router.refresh()} renderActions={()=>guest&&ringEnabled?<Link href="/login">参加する</Link>:<button type="button" disabled>準備中</button>}/><p className={styles.gameNote}>{guest?'人数・着席状況はログイン後に確認できます。':ringEnabled?'現在の着席状況を取得できません。時間をおいて更新してください。':'会員チップでの対戦は準備中です。練習卓は利用できます。'}</p></>:gameTab==='practice'?<div className={styles.practice}><PokerLobbyPreview isGuestPreview={guest} practiceOnly compact tournamentsEnabled={false}/></div>:<div className={styles.embedded}>{registration}</div>}
        </div>
       </section>
       {tournamentsEnabled&&<section className={styles.upcoming} aria-labelledby="lobby-upcoming-title"><h2 id="lobby-upcoming-title"><LobbyIcon name="trophy"/>開催予定のトーナメント</h2>{upcoming.length?<div className={styles.upcomingGrid}>{upcoming.map(t=><article key={t.id} className={styles.eventCard}>{t.image_url?<img src={t.image_url} alt="" width="72" height="72"/>:<span className={styles.trophyArt}><LobbyIcon name="trophy"/></span>}<div><h3>{t.title}</h3><p>{formatDate(t.starts_at)}（日本時間）</p><button type="button" className={styles.outlineButton} onClick={()=>go('tournaments')}>詳細を見る</button></div></article>)}</div>:<p className={styles.emptyMessage}>現在、開催予定の大会はありません。受付が始まるとここに表示します。</p>}</section>}
       {board&&<div className={`${styles.panel} ${styles.board}`}>{board}</div>}
      </>:<section className={`${styles.panel} ${styles.detailPane}`} aria-label={title}><h2><LobbyIcon name={navigation.find(item=>item.id===active)?.icon??'home'}/>{title}</h2>
       {active==='assigned'?<><h3>リングの参加卓</h3>{own?<div className={styles.ownTable}><strong>{own.title}</strong><p>{own.status==='seated'?`席 ${own.seat} に着席済み`:'持ち込み予約中'} · {own.stack.toLocaleString()} chip</p><Link className={styles.goldButton} href={`/poker-ring/${own.tableId}?view=table`}>着席中の卓へ</Link></div>:<p className={styles.lead}>リングゲームのタブで現在の着席状況を確認できます。</p>}<button type="button" className={styles.outlineButton} onClick={()=>{go('lobby');setGameTab('ring');}}>リング卓を確認する</button>{tournamentsEnabled&&<div className={styles.embedded}>{assigned}</div>}</>:active==='tournaments'?<div className={styles.embedded}>{registration}</div>:active==='skins'?<TablePreferences><SkinPicker/></TablePreferences>:<><RecordPlaceholder kind={active==='ranking'?'ranking':'champions'} expanded/>{active==='ranking'&&!guest&&<Link className={styles.outlineButton} href="/mypage/poker">自分の残高・順位を見る</Link>}</>}
      </section>}
     </div>
     <aside className={styles.rightRail} aria-label="ランキングと優勝記録">
      <section className={styles.recordPanel}><div className={styles.recordHeading}><h2><LobbyIcon name="chart"/>持ちチップランキング</h2><small>保有チップ順</small></div><RecordPlaceholder kind="ranking"/><button type="button" className={styles.railButton} onClick={()=>go('ranking')}>ランキングを見る</button></section>
      <section className={styles.recordPanel}><div className={styles.recordHeading}><h2><LobbyIcon name="trophy"/>歴代大会優勝者</h2></div><RecordPlaceholder kind="champions"/><button type="button" className={styles.railButton} onClick={()=>go('champions')}>優勝者一覧を見る</button></section>
     </aside>
    </div>
    <footer className={styles.footer}><span>POKER SUMMIT · ONLINE POKER</span><span>仮想チップでプレイ · 時刻は日本時間</span></footer>
   </main>
  </div>
 </div>;
}

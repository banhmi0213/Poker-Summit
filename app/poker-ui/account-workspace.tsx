'use client';
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import type {PokerPane} from './workspace';
import {LobbyIcon,type LobbyIconName} from '@/app/poker-lobby/lobby-icon';
import styles from './account-workspace.module.css';
const icons:Record<string,LobbyIconName>={ring:'chart',summary:'trophy',upcoming:'people',history:'trophy',tendencies:'chart',gto:'cards',preflop:'cards',flop:'cards',quiz:'cards',river:'cards',hands:'cards',replay:'cards'};
export function PokerAccountWorkspace({panes}:{panes:PokerPane[]}){
 const [active,setActive]=useState(panes[0]?.id),[menuOpen,setMenuOpen]=useState(false);
 const pane=panes.find(p=>p.id===active)??panes[0];
 const choose=(id:string)=>{setActive(id);setMenuOpen(false);};
 const firstOf=(ids:string[])=>ids.find(id=>panes.some(p=>p.id===id));
 const record=firstOf(['ring','tendencies','summary']),learn=firstOf(['gto','preflop','quiz']);
 function shortcut(id:string|undefined,label:string):ReactNode{return id?<button type="button" onClick={()=>choose(id)}>{label}</button>:<Link href="/mypage/poker">プレイヤーページを開く</Link>;}
 return <div className={styles.shell} data-poker-account="champagne">
  <header className={styles.header}><Link href="/poker-lobby" className={styles.brand}><img src="/images/logo.png" alt="Poker Summit" width="300" height="64"/></Link><nav aria-label="ポーカーナビゲーション"><Link href="/poker-lobby">ロビー</Link><Link href="/mypage/poker" aria-current="page">プレイヤーページ</Link><Link href="/mypage">マイページ</Link><Link href="/">サイトトップ</Link><span className={styles.avatar} aria-hidden="true"><LobbyIcon name="people"/></span></nav></header>
  <div className={styles.layout}>
   <aside className={styles.sidebar}><div className={styles.sidebarTitle}><LobbyIcon name="finger"/><strong>メニュー</strong></div><p className={styles.sidebarIntro}>見たい項目を選んでください。</p><button type="button" className={styles.menuToggle} onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-controls="account-panes">表示する項目<span aria-hidden="true">{menuOpen?'−':'＋'}</span></button><nav id="account-panes" className={styles.panes} data-open={menuOpen} aria-label="表示内容">{panes.map(p=><button type="button" key={p.id} aria-pressed={pane?.id===p.id} onClick={()=>choose(p.id)}><LobbyIcon name={icons[p.id]??'cards'}/><span>{p.label}</span></button>)}</nav><div className={styles.sidebarFoot}><Link href="/poker-lobby"><LobbyIcon name="home"/>ロビーに戻る</Link><Link href="/mypage"><LobbyIcon name="settings"/>会員プロフィール・設定</Link></div></aside>
   <main className={styles.main}><div className={styles.heading}><h1>プレイヤーページ</h1><p>記録を振り返って、次のプレイへ。</p></div>
    <div className={styles.summaryGrid}>
     <section className={styles.summaryCard}><img className={styles.chips} src="/images/poker-lobby/chip-stacks-finger.webp" alt="" width="86" height="86"/><div><h2>チップ・成績</h2><p>残高と順位、プレイの記録。</p>{shortcut(record,'自分の記録を見る')}</div></section>
     <section className={styles.summaryCard}><span className={styles.summaryIcon}><LobbyIcon name="cards"/></span><div><h2>学ぶ・練習する</h2><p>GTOの表とクイズで振り返り。</p>{shortcut(learn,'学習メニューを開く')}</div></section>
     <section className={styles.summaryCard}><span className={styles.summaryIcon}><LobbyIcon name="chart"/></span><div><h2>ハンドを振り返る</h2><p>履歴から一手ずつ再生。</p><Link href="/mypage/poker/hands">ハンド履歴を見る</Link></div></section>
    </div>
    <div className={styles.contentGrid}><section className={styles.content}><header className={styles.panelHeading}><div><p className={styles.eyebrow}>{pane?.eyebrow}</p><h2>{pane?.label}</h2><p>{pane?.description}</p></div><span className={styles.panelIcon} aria-hidden="true"><LobbyIcon name={icons[pane?.id??'']??'cards'}/></span></header><div key={pane?.id} className={styles.panel} aria-label={pane?.label}>{pane?.content}</div></section>
     <aside className={styles.guide} aria-label="プレイのヒント"><div className={styles.guideHeading}><LobbyIcon name="finger"/><h2>次の一手につなげる</h2></div><p>記録を見直して、気になる場面から少しずつ。</p><section><span>01</span><h3>自分の傾向を知る</h3><p>参加率やレイズの割合を、ハンド数と一緒に確認。</p>{panes.some(p=>p.id==='tendencies')&&<button type="button" onClick={()=>choose('tendencies')}>成績・癖の分析を見る</button>}</section><section><span>02</span><h3>一手ずつ振り返る</h3><p>ハンドを再生して、ベットやフォールドの場面を見直す。</p><Link href="/mypage/poker/hands">ハンド履歴を開く</Link></section><Link className={styles.returnLink} href="/poker-lobby">ロビーに戻る</Link></aside>
    </div><footer className={styles.footer}><span>POKER SUMMIT · PLAYER CENTER</span><span>仮想チップでプレイ · 時刻は日本時間</span></footer>
   </main>
  </div>
 </div>;
}

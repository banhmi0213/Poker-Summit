'use client';
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import styles from './workspace.module.css';
import {SummitMark} from './brand-mark';
import {PokerAccountWorkspace} from './account-workspace';
export type PokerPane={id:string;label:string;eyebrow:string;description:string;content:ReactNode};
type WorkspaceProps={kind:'lobby'|'account';panes:PokerPane[];admin?:boolean;guest?:boolean};
export function PokerWorkspace(props:WorkspaceProps){return props.kind==='account'?<PokerAccountWorkspace panes={props.panes}/>:<LegacyWorkspace {...props}/>;}
function LegacyWorkspace({kind,panes,admin=false,guest=false}:{kind:'lobby'|'account';panes:PokerPane[];admin?:boolean;guest?:boolean}){
 const [active,setActive]=useState(panes[0]?.id),pane=panes.find(p=>p.id===active)??panes[0];
 return <div className={styles.shell}>
 <header className={styles.header}><Link href="/poker-lobby" className={styles.brand}><SummitMark className={styles.brandMark}/><div>POKER SUMMIT<small>ONLINE POKER</small></div></Link><nav aria-label="ポーカーナビゲーション"><Link href="/poker-lobby" aria-current={kind==='lobby'?'page':undefined}>ロビー</Link><Link href="/mypage/poker" aria-current={kind==='account'?'page':undefined}>マイページ</Link><Link href="/">サイトトップ</Link>{admin&&<Link href="/admin/poker-statistics">総合管理</Link>}</nav></header>
 <div className={styles.layout}>
 <aside className={styles.sidebar}><p className={styles.kicker}>{kind==='lobby'?'PLAY & EXPLORE':'PLAYER CENTER'}</p><h1>{kind==='lobby'?'ポーカーロビー':'マイページ'}</h1><p className={styles.caption}>{kind==='lobby'?'参加する大会と卓を見つける。':'あなたの記録を、ひとつの場所で。'}</p><nav className={styles.panes} aria-label="表示内容">{panes.map((p,i)=><button key={p.id} type="button" aria-pressed={p.id===pane?.id} onClick={()=>setActive(p.id)}><span className={styles.index}>0{i+1}</span>{p.label}<span aria-hidden="true">›</span></button>)}</nav><div className={styles.sidebarFoot}><span className={styles.statusDot}/>{guest?'ゲストプレビュー':'会員向けオンラインポーカー'}<Link href={guest?'/login':'/mypage'}>{guest?'ログインする':'会員プロフィール・設定'} ↗</Link></div></aside>
 <main className={styles.main}><div className={styles.panelHeading}><div><p className={styles.kicker}>{pane?.eyebrow}</p><h2>{pane?.label}</h2><p>{pane?.description}</p></div><span className={styles.badge}>{kind==='lobby'?'LOBBY':'MY RECORDS'}</span></div><div key={pane?.id} className={styles.panel} aria-label={pane?.label}>{pane?.content}</div></main>
 <aside className={styles.guide}><div className={styles.guideMark} aria-hidden="true">♠</div><p className={styles.kicker}>YOUR NEXT HAND</p><h2>つながる。<br/>挑戦する。<br/>記録が残る。</h2><p>大会への参加から結果の確認まで、ロビーとマイページからアクセスできます。</p><div className={styles.guideCard}><strong>大会の成績</strong><p>優勝確定後に最終順位と通算成績を記録します。</p></div><div className={styles.guideCard}><strong>リングチップ</strong><p>リング用残高と大会の持ち点は別に管理します。</p></div><Link href={kind==='lobby'?'/mypage/poker':'/poker-lobby'}>{kind==='lobby'?'マイページへ':'ロビーへ戻る'} →</Link></aside>
 </div><footer className={styles.footer}><span>POKER SUMMIT · ONLINE EXPERIENCE</span><span>仮想チップでプレイ · 時刻は日本時間</span></footer>
 </div>;
}

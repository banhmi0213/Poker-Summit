import Link from 'next/link';
import styles from './hand-history.module.css';
import type {HandHistoryView} from '@/lib/poker/hand-histories';
import type {Card} from '@/lib/poker/engine';

const rank=(r:number)=>({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[r]??String(r);
const suit={c:'♣',d:'♦',h:'♥',s:'♠'} as const;
export const handDate=(s:string)=>new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
export const chips=(n:number)=>`${n>0?'+':''}${n.toLocaleString()}`;
/** null = face-down card (not yours and not shown at showdown). */
export function HistoryCards({cards,count=2}:{cards:Card[]|null;count?:number}){
 return <span className={styles.cards}>{cards?cards.map((c,i)=><span key={i} className={styles.card} data-red={c.suit==='h'||c.suit==='d'}>{rank(c.rank)}{suit[c.suit]}</span>):Array.from({length:count},(_,i)=><span key={i} className={styles.back} aria-label="伏せたカード"/>)}</span>;
}
export function handTitle(h:HandHistoryView){return h.title??(h.kind==='ring'?'リングゲーム':'トーナメント');}

/** Member list: your position, your cards and your result per hand. Operators get every player instead. */
export function HandHistoryList({hands,base,admin=false,moreHref}:{hands:HandHistoryView[];base:string;admin?:boolean;moreHref?:string|null}){
 if(!hands.length)return <p>{admin?'ハンド履歴はまだありません。':'まだ記録されたハンドはありません。リングゲームや大会でプレイすると、ここに1ハンドずつ残ります。'}</p>;
 return <>
  <div className={styles.list}>{hands.map(h=>{const me=h.players.find(p=>p.you);const label=`${handTitle(h)} ${handDate(h.playedAt)}`;
   return <Link key={h.handId} href={`${base}/${h.handId}`} className={styles.row} aria-label={`${label}のハンドを再生する`}>
    <span className={styles.meta}><strong>{handTitle(h)}{h.handNumber?` #${h.handNumber}`:''}</strong><small>{handDate(h.playedAt)} · {h.terms.sb.toLocaleString()}/{h.terms.bb.toLocaleString()}{admin?` · ${h.players.map(p=>p.name).join('・')}`:''}</small></span>
    {admin||!me?<span className={styles.badge}>{h.players.length}人</span>:<span className={styles.badge}>{me.position}</span>}
    {admin||!me?<HistoryCards cards={h.board.slice(0,5)} count={0}/>:<HistoryCards cards={me.hole}/>}
    {admin||!me?<span className={styles.net}>{(h.players.find(p=>h.result.winners.includes(p.seatId))?.name)??''}</span>:<span className={styles.net} data-sign={me.net>0?'plus':me.net<0?'minus':undefined}>{chips(me.net)}</span>}
   </Link>;})}</div>
  {moreHref&&<p className={styles.more}><Link href={moreHref}>さらに前のハンドを見る</Link></p>}
 </>;
}

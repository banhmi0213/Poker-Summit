import styles from './hand-history.module.css';
import type {HandStatsSummary} from '@/lib/poker/hand-histories';

const rate=(n:number,d:number)=>d>0?`${Math.round(Number(n)*1000/Number(d))/10}%`:'—';
const signed=(n:number)=>`${Number(n)>0?'+':''}${Number(n).toLocaleString()}`;
type Item={label:string;n:number;d:number;note:string};
export function statItems(s:HandStatsSummary):Item[]{return [
 {label:'VPIP',n:s.vpip,d:s.hands,note:'自分からチップを入れて参加した割合'},
 {label:'PFR',n:s.pfr,d:s.hands,note:'プリフロップでレイズして参加した割合'},
 {label:'3ベット',n:s.three_bet,d:s.three_bet_opp,note:'1人がレイズした後に、さらにレイズした割合'},
 {label:'3ベットにフォールド',n:s.fold_to_3bet,d:s.fold_to_3bet_opp,note:'自分のレイズに3ベットされて降りた割合'},
 {label:'Cベット',n:s.cbet,d:s.cbet_opp,note:'プリフロップで最後にレイズして、フロップでも打った割合'},
 {label:'Cベットにフォールド',n:s.fold_to_cbet,d:s.fold_to_cbet_opp,note:'相手のCベットに降りた割合'},
 {label:'WTSD',n:s.wtsd,d:s.saw_flop,note:'フロップを見たハンドのうち、ショーダウンまで行った割合'},
 {label:'W$SD',n:s.wsd,d:s.wtsd,note:'ショーダウンまで行って勝った割合'},
];}
/** Member's own tendencies. Small samples swing a lot, so counts are always shown. */
export function HandStatsView({stats}:{stats:HandStatsSummary}){
 const hands=Number(stats.hands);
 if(!hands)return <p>まだ集計できるハンドがありません。リングゲームをプレイすると、ハンドごとに自動で集計されます。</p>;
 return <div className={styles.replay}>
  <div className={styles.head}><strong>{hands.toLocaleString()}ハンド</strong><span>収支 {signed(stats.net)}チップ</span><span>100ハンドあたり {signed(stats.bb100)}BB</span></div>
  {hands<100&&<p>まだハンド数が少ないため、数字は大きくぶれます。目安として300ハンド以上で傾向が見えてきます。</p>}
  <div className={styles.stats}>{statItems(stats).map(i=><div key={i.label} className={styles.stat}><small>{i.label}</small><b>{rate(i.n,i.d)}</b><span>{Number(i.n).toLocaleString()} / {Number(i.d).toLocaleString()}</span><p>{i.note}</p></div>)}</div>
  {stats.positions.length>0&&<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>ポジション</th><th>ハンド数</th><th>VPIP</th><th>PFR</th><th>収支</th><th>100ハンドあたり</th></tr></thead><tbody>{stats.positions.map(p=><tr key={p.position}><td>{p.position}</td><td>{Number(p.hands).toLocaleString()}</td><td>{rate(p.vpip,p.hands)}</td><td>{rate(p.pfr,p.hands)}</td><td>{signed(p.net)}</td><td>{signed(p.bb100)}BB</td></tr>)}</tbody></table></div>}
 </div>;
}

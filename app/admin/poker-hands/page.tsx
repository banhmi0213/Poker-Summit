import {loadAdminHandStats,loadHandHistories} from '@/lib/poker/hand-histories';
import {HandHistoryList} from '@/app/poker-ui/hand-history-list';
import styles from '@/app/poker-ui/hand-history.module.css';
export const dynamic='force-dynamic';
const rate=(n:number,d:number)=>Number(d)>0?`${Math.round(Number(n)*1000/Number(d))/10}%`:'—';
export default async function Page({searchParams}:{searchParams:{before?:string}}){
 const [hands,stats]=await Promise.all([loadHandHistories(true,searchParams.before),loadAdminHandStats()]);
 const more=hands&&hands.length===20?`/admin/poker-hands?before=${encodeURIComponent(hands[hands.length-1].playedAt)}`:null;
 return <main className="container"><h1>ポーカー ハンド履歴</h1><p>運営専用です。フォールドした手札を含め、全員の手札を表示します。チップの受け渡しなど不正の確認に使い、外部に公開しないでください。</p>
  {stats&&stats.members.length>0&&<><h2>会員ごとの傾向（リングゲーム）</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>表示名</th><th>ハンド数</th><th>100ハンドあたり</th><th>VPIP</th><th>PFR</th><th>3ベット</th><th>Cベット</th><th>WTSD</th></tr></thead><tbody>{stats.members.map(m=><tr key={m.memberId}><td>{m.name}</td><td>{Number(m.hands).toLocaleString()}</td><td>{Number(m.bb100).toLocaleString()}BB</td><td>{rate(m.vpip,m.hands)}</td><td>{rate(m.pfr,m.hands)}</td><td>{rate(m.three_bet,m.three_bet_opp)}</td><td>{rate(m.cbet,m.cbet_opp)}</td><td>{rate(m.wtsd,m.saw_flop)}</td></tr>)}</tbody></table></div></>}
  <h2>ハンド一覧</h2>
  {hands?<div className={styles.surface}><HandHistoryList hands={hands} base="/admin/poker-hands" admin moreHref={more}/></div>:<p>運営権限またはハンド履歴の設定をご確認ください。データを取得できませんでした。</p>}</main>;
}

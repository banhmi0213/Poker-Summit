import {loadHandHistory} from '@/lib/poker/hand-histories';
import {HandReplay} from '@/app/poker-ui/hand-replay';
import styles from '@/app/poker-ui/hand-history.module.css';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:{handId:string}}){
 const hand=await loadHandHistory(params.handId,true);
 return <main className="container"><h1>ハンド詳細（運営）</h1><p><a href="/admin/poker-hands">ハンド履歴に戻る</a></p>
  {hand?<><div className={styles.surface}><HandReplay hand={hand}/></div><h2>参加者</h2><table className="table"><thead><tr><th>席</th><th>ポジション</th><th>表示名</th><th>会員ID</th><th>開始</th><th>終了</th><th>収支</th></tr></thead><tbody>{hand.players.map(p=><tr key={p.seatId}><td>{p.seat}</td><td>{p.position}</td><td>{p.name}</td><td>{p.memberId}</td><td>{p.startStack.toLocaleString()}</td><td>{p.endStack.toLocaleString()}</td><td>{p.net.toLocaleString()}</td></tr>)}</tbody></table></>:<p>このハンドは見つかりませんでした。</p>}</main>;
}

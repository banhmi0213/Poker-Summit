import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export const metadata={title:'リングの同じ相手とのやり取り | 管理画面',robots:{index:false,follow:false}};
type Flow={winnerId:string;loserId:string;winnerName:string;loserName:string;winnerEmail:string|null;loserEmail:string|null;hands:number;headsUp:number;netBb:number;lastAt:string};
const when=(iso:string)=>new Date(iso).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
/** Owner 2026/11/01 (同じやり取りがあるかの監視が必要): pairs of members where chips keep flowing one way at ring tables.
 * Counted from hands with one winner: what each loser lost to that winner, in BB, netted both ways. Admin only (the RPC checks it). */
export default async function Page({searchParams}:{searchParams:{days?:string}}){
 const days=[1,7,30].includes(Number(searchParams.days))?Number(searchParams.days):7;
 const client=await createClient();const {data,error}=await client.rpc('poker_admin_ring_pair_flows',{p_days:days,p_limit:50});
 const rows=(Array.isArray(data)?data:[]) as Flow[];
 return <main className="container">
  <h1>リングの同じ相手とのやり取り</h1>
  <p className="muted">同じ2人の間で、チップが片方へ流れ続けていないかを見る画面です（わざと負けて段位を上げさせる・チップを渡す行為の確認用）。勝った人が1人のハンドで、負けた人から勝った人へ移ったBBを、2人の組ごとに差し引きして多い順に並べています。</p>
  <p className="muted">目安：同じ組が何十ハンドも続けて片方だけ勝っている、2人だけの対戦（ヘッズアップ）が多い、深夜に集中している、などは要確認です。上に出ること自体は不正の証拠ではありません。ハンド履歴で中身を確かめてください。</p>
  <form method="get" style={{margin:'12px 0'}}><label>期間 <select name="days" defaultValue={String(days)}><option value="1">24時間</option><option value="7">7日</option><option value="30">30日</option></select></label> <button className="btn" type="submit">表示</button></form>
  {error&&<p>データを取得できませんでした。運営権限をご確認ください。</p>}
  {!error&&!rows.length&&<p>この期間に該当するやり取りはありません。</p>}
  {rows.length>0&&<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>勝った側</th><th>負けた側</th><th>差し引き</th><th>同じハンド</th><th>うち2人だけ</th><th>最後</th></tr></thead>
   <tbody>{rows.map(r=><tr key={r.winnerId+r.loserId}>
    <td><Link href={`/admin/members/${r.winnerId}`}>{r.winnerName}</Link><br/><small className="muted">{r.winnerEmail??''}</small></td>
    <td><Link href={`/admin/members/${r.loserId}`}>{r.loserName}</Link><br/><small className="muted">{r.loserEmail??''}</small></td>
    <td style={{whiteSpace:'nowrap',fontWeight:700}}>+{Number(r.netBb).toLocaleString('ja-JP',{maximumFractionDigits:1})} BB</td>
    <td>{r.hands.toLocaleString()}</td><td>{r.headsUp.toLocaleString()}</td><td style={{whiteSpace:'nowrap'}}>{when(r.lastAt)}</td></tr>)}</tbody></table></div>}
  <p style={{marginTop:16}}><Link href="/admin/poker-hands">ポーカー ハンド履歴へ</Link></p>
 </main>;
}

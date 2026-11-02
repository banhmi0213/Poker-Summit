import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {loadPokerStatistics} from '@/lib/poker/statistics';
export const dynamic='force-dynamic';
export const metadata={title:'大会結果・入賞者 | 管理画面',robots:{index:false,follow:false}};
const placeText=(place:number,through:number)=>through&&through!==place?`${place}〜${through}位`:`${place}位`;
const when=(iso:string)=>new Date(iso).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
/** Owner 2026/10/31 (運営側は賞金があるから会員情報もわかるように): each finished tournament's full standings with the
 * member's email and a link to the member page, for paying out prizes. Admin only (both RPCs check it). */
export default async function Page({searchParams}:{searchParams:{t?:string}}){
 const [data,members]=await Promise.all([loadPokerStatistics(true),createClient().then(c=>c.rpc('admin_list_members'))]);
 if(!data)return <main className="container"><h1>大会結果・入賞者</h1><p>運営権限をご確認ください。データを取得できませんでした。</p></main>;
 const emails=new Map<string,string>(((members.data??[]) as {id:string;email:string|null}[]).map(m=>[m.id,m.email??'']));
 const byTournament=new Map<string,{title:string;finished_at:string;rows:{memberId:string;name:string;place:number;tiedThrough:number}[]}>();
 for(const h of data.history){const t=byTournament.get(h.tournament_id)??{title:h.title,finished_at:h.finished_at,rows:[]};t.rows.push(h.row);byTournament.set(h.tournament_id,t);}
 const list=[...byTournament.entries()].sort((a,b)=>b[1].finished_at.localeCompare(a[1].finished_at));
 const shown=searchParams.t?list.filter(([id])=>id===searchParams.t):list;
 return <main className="container">
  <h1>大会結果・入賞者</h1>
  <p className="muted">終了した大会の最終順位です。賞品の連絡・お渡しの確認にお使いください。会員のメールアドレスは運営だけに表示されます。</p>
  <p><a className="btn" href="/admin/poker-statistics/export?type=history">歴代大会結果CSV</a></p>
  {list.length>1&&<form method="get" style={{margin:'12px 0'}}><label>大会を選ぶ <select name="t" defaultValue={searchParams.t??''}><option value="">すべての大会</option>{list.map(([id,t])=><option key={id} value={id}>{t.title}（{when(t.finished_at)}）</option>)}</select></label> <button className="btn" type="submit">表示</button></form>}
  {!shown.length&&<p>終了した大会はまだありません。</p>}
  {shown.map(([id,t])=><section key={id} className="card" style={{marginTop:16}}>
   <h2 style={{fontSize:18}}>{t.title}</h2><p className="muted">終了：{when(t.finished_at)} · 参加 {t.rows.length}人</p>
   <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>順位</th><th>表示名</th><th>メールアドレス</th><th>会員</th></tr></thead>
    <tbody>{[...t.rows].sort((a,b)=>a.place-b.place||a.name.localeCompare(b.name,'ja')).map(r=><tr key={r.memberId}>
     <td style={{whiteSpace:'nowrap',fontWeight:r.place<=3?700:undefined}}>{placeText(r.place,r.tiedThrough)}</td><td>{r.name}</td><td>{emails.get(r.memberId)||'—'}</td>
     <td><Link href={`/admin/members/${r.memberId}`}>会員詳細</Link></td></tr>)}</tbody></table></div>
  </section>)}
 </main>;
}

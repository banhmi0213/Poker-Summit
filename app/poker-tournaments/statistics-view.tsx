'use client';
import {SummitChipBalance} from '@/app/poker-ui/chip-balance';
import {useState} from 'react';
import type {PokerStatistics} from '@/lib/poker/statistics';
const date=(s:string)=>new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
export function StatisticsView({data,admin=false,section}:{data:PokerStatistics;admin?:boolean;section?:'summary'|'ring'|'history'|'upcoming'}){
 const [page,setPage]=useState(0);const count=section==='ring'?data.ring.length:section==='history'?data.history.length:section==='upcoming'?data.upcoming.length:section==='summary'?data.players.length:0;const pages=Math.max(1,Math.ceil(count/5)),current=Math.min(page,pages-1);const windowed=<T,>(rows:T[])=>section?rows.slice(current*5,current*5+5):rows;
 const show=(name:string)=>!section||section===name;
 return <>
 <p>集計日時：{date(data.asOf)}（日本時間）</p>
 {show('ring')&&!admin&&<SummitChipBalance detailed/>}
 {show('ring')&&admin&&<section className="card"><h2>リング残高{admin?'ランキング':'・自分の順位'}</h2><p>リング残高と卓への持ち込み分の合計で順位を集計します。大会の持ち点は含めません。同額は同順位です。</p>{data.ring.length?<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>順位</th>{admin&&<th>表示名</th>}<th>残高</th><th>卓へ持ち込み中</th><th>合計</th></tr></thead><tbody>{windowed(data.ring).map(r=><tr key={r.member_id}><td>{r.position}位</td>{admin&&<td>{r.name}</td>}<td>{r.available.toLocaleString()}</td><td>{r.in_play.toLocaleString()}</td><td>{r.total.toLocaleString()}</td></tr>)}</tbody></table></div>:<p>リング残高の連携は未開始です。残高・順位はまだ確定していません。</p>}</section>}
 {show('summary')&&<section className="card"><h2>トーナメント通算成績</h2><p>終了・確定した大会のみ集計。同率順位は同率の開始順位に数えます。</p>{data.players.length?<div style={{overflowX:'auto'}}><table className="table"><thead><tr>{admin&&<th>表示名</th>}<th>参加大会数</th><th>1位</th><th>2位</th><th>3位</th></tr></thead><tbody>{windowed(data.players).map(p=><tr key={p.member_id}>{admin&&<td>{p.name}</td>}<td>{p.played}回</td><td>{p.firsts}回</td><td>{p.seconds}回</td><td>{p.thirds}回</td></tr>)}</tbody></table></div>:<p>確定した大会成績はまだありません。</p>}</section>}
 {show('history')&&<section className="card"><h2>歴代トーナメント順位・参加大会履歴</h2>{data.history.length?<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>大会</th><th>終了日時</th>{admin&&<th>表示名</th>}<th>最終順位</th></tr></thead><tbody>{windowed(data.history).map(h=><tr key={`${h.tournament_id}:${h.row.memberId}`}><td>{h.title}</td><td>{date(h.finished_at)}</td>{admin&&<td>{h.row.name}</td>}<td>{h.row.place===h.row.tiedThrough?`${h.row.place}位`:`同率${h.row.place}位（${h.row.place}〜${h.row.tiedThrough}位）`}</td></tr>)}</tbody></table></div>:<p>履歴はまだありません。</p>}</section>}
 {!admin&&show('upcoming')&&<section className="card"><h2>参加予定・進行中の大会</h2>{data.upcoming.length?windowed(data.upcoming).map(t=><p key={t.id}>{t.title} · {date(t.starts_at)} {t.room_id?<a href={`/poker-online/${t.room_id}`}>卓へ入る</a>:<a href="/poker-lobby">受付状況を見る</a>}</p>):<p>参加登録した大会はありません。</p>}</section>}
 {section&&pages>1&&<nav aria-label="一覧のページ"><button type="button" disabled={current===0} onClick={()=>setPage(v=>Math.max(0,v-1))}>前へ</button> <span>{current+1} / {pages}</span> <button type="button" disabled={current>=pages-1} onClick={()=>setPage(v=>v+1)}>次へ</button></nav>}
 {admin&&<p>各一覧は最大500件を表示・出力します。ブログに使用する前に集計日時と対象をご確認ください。</p>}
 </>;
}

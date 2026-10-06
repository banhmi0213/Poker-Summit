import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TournamentEditor } from "./editor";
import { TournamentDelete } from "./delete-form";
export default async function Page({searchParams}:{searchParams:{edit?:string;deleted?:string;page?:string}}){
 const db=await createClient();
 const {data,error}=await db.from("major_tournaments").select("*").order("created_at",{ascending:false});
 const entry=data?.find(e=>e.id===searchParams.edit);
 const count=data?.length||0,pageSize=6,totalPages=Math.max(1,Math.ceil(count/pageSize));
 const requested=Number(searchParams.page||"1");
 const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,totalPages):1;
 const entries=(data||[]).slice((page-1)*pageSize,page*pageSize);
 const listHref=(target:number)=>{const p=new URLSearchParams();if(searchParams.edit)p.set("edit",searchParams.edit);if(target>1)p.set("page",String(target));return "/admin/major-tournaments"+(p.size?"?"+p:"")+"#registered-tournaments";};

 return <div style={{maxWidth:1000}}><div style={{display:"flex",gap:16,justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h1 style={{fontSize:22}}>国内外大型大会</h1><Link className="btn" href="/major-tournaments">公開ページを見る →</Link></div><p style={{marginBottom:16}}>大会の詳細とスケジュールを登録できます。下書きはサイトに表示されません。</p>
 {searchParams.deleted==="1"&&<p role="status" style={{marginBottom:16}}>大会を削除しました。</p>}
 {error?<p className="err">大会情報を読み込めませんでした。</p>:<><h2 style={{fontSize:18,marginBottom:16}}>{entry?"大会を編集":"新規大会追加"}</h2>{searchParams.edit&&!entry&&<p className="err">大会が見つかりません。</p>}<TournamentEditor key={entry?.id||"new"} entry={entry}/><section id="registered-tournaments" className="amt-list"><div className="amt-list-heading"><h2>登録済みの大会 <span>全{count}件</span></h2>{entry&&<Link href="/admin/major-tournaments" className="btn">新規大会を追加</Link>}</div>
 {entries.map(e=><div className="amt-row" key={e.id}><div className="amt-copy"><div className="amt-title"><strong>{e.title}</strong><span className="badge">{e.active?"公開中":"下書き"}</span></div><p className="muted small">{e.scope} / {e.location}　{e.start_date||"開催日未定"}{e.end_date&&`〜 ${e.end_date}`}</p></div><div className="amt-actions"><Link className="btn" href={`/admin/major-tournaments?edit=${e.id}&page=${page}`}>編集</Link>{e.active&&<Link className="btn" href={`/major-tournaments/${e.id}`}>詳細を見る</Link>}<TournamentDelete id={e.id} title={e.title}/></div></div>)}
 {!count&&<p className="muted">まだ大会が登録されていません。</p>}
 {count>0&&<div className="amt-pagination"><span>{count}件中 {(page-1)*pageSize+1}〜{Math.min(page*pageSize,count)}件</span>{totalPages>1&&<nav aria-label="登録済み大会のページ切り替え">{page>1?<Link className="btn" href={listHref(page-1)}>← 前へ</Link>:<span className="btn" aria-disabled="true">← 前へ</span>}<span>{page} / {totalPages}ページ</span>{page<totalPages?<Link className="btn" href={listHref(page+1)}>次へ →</Link>:<span className="btn" aria-disabled="true">次へ →</span>}</nav>}</div>}
 </section></>}
 </div>;
}
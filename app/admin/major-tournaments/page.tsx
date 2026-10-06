import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TournamentEditor } from "./editor";
import { TournamentDelete } from "./delete-form";
export default async function Page({searchParams}:{searchParams:{edit?:string;deleted?:string}}){
 const db=await createClient();
 const {data,error}=await db.from("major_tournaments").select("*").order("created_at",{ascending:false});
 const entry=data?.find(e=>e.id===searchParams.edit);
 return <div style={{maxWidth:1000}}><div style={{display:"flex",gap:16,justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h1 style={{fontSize:22}}>国内外大型大会</h1><Link className="btn" href="/major-tournaments">公開ページを見る →</Link></div><p style={{marginBottom:16}}>大会の詳細とスケジュールを登録できます。下書きはサイトに表示されません。</p>
 {searchParams.deleted==="1"&&<p role="status" style={{marginBottom:16}}>大会を削除しました。</p>}
 {error?<p className="err">大会情報を読み込めませんでした。</p>:<><h2 style={{fontSize:18,marginBottom:16}}>{entry?"大会を編集":"新規大会追加"}</h2>{searchParams.edit&&!entry&&<p className="err">大会が見つかりません。</p>}<TournamentEditor key={entry?.id||"new"} entry={entry}/><h2 style={{fontSize:18,margin:"24px 0 12px"}}>登録済みの大会</h2>{entry&&<Link href="/admin/major-tournaments" className="btn">新規大会を追加</Link>}
 {data?.map(e=><div className="card" key={e.id}><strong>{e.title}</strong> <span className="badge">{e.active?"公開中":"下書き"}</span><p className="muted small">{e.scope} / {e.location}　{e.start_date} {e.end_date&&`〜 ${e.end_date}`}</p><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><Link className="btn" href={`/admin/major-tournaments?edit=${e.id}`}>編集</Link>{e.active&&<Link className="btn" href={`/major-tournaments/${e.id}`}>詳細を見る</Link>}<TournamentDelete id={e.id} title={e.title}/></div></div>)}{!data?.length&&<p className="muted">まだ大会が登録されていません。</p>}</>}
 </div>;
}
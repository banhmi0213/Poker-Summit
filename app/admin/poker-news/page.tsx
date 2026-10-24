import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteNewsButton } from "./delete-button";
import { NewsEditor,NewsImporter } from "./editor";
export const dynamic="force-dynamic";
export default async function AdminPokerNews({searchParams}:{searchParams:{edit?:string;page?:string}}){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect("/admin-login?next=/admin/poker-news");const {data:admin}=await client.rpc("is_admin");if(admin!==true)return <p>運営権限が必要です。</p>;
 const page=Math.max(1,Number.parseInt(searchParams.page||"1",10)||1);
 const [{data:rows,count,error},{data:blogs,error:blogError}]=await Promise.all([client.from("poker_news").select("*",{count:"exact"}).order("news_date",{ascending:false}).order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*30,page*30-1),client.from("blog_entries").select("id,title,active").order("created_at",{ascending:false}).limit(1000)]);
 let entry;if(searchParams.edit){const {data,error:entryError}=await client.from("poker_news").select("*").eq("id",searchParams.edit).maybeSingle();if(entryError||!data)return <div className="container"><p>指定したニュースが見つかりません。</p><Link href="/admin/poker-news">管理画面へ戻る</Link></div>;entry=data;}
 if(error||blogError)return <div className="container"><p role="alert">データを取得できませんでした。再読み込みしてください。</p></div>;
 return <div className="container"><h1>ポーカーニュース管理</h1><p>見出し・概要・情報元・関連記事を登録すると、TOPとニュース一覧に反映されます。</p><p><Link href="/poker-news" target="_blank">公開ニュース一覧を確認</Link>　<Link href="/admin/poker-news">新規登録</Link></p><NewsEditor key={entry?.id||"new"} entry={entry} blogs={blogs||[]} today={new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})}/><NewsImporter/><section className="panel"><h2>登録済みニュース（{count||0}件）</h2>{(rows||[]).map(x=><div key={x.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,padding:"14px 0",borderBottom:"1px solid #e9dfcc"}}><p style={{margin:0,flex:"1 1 300px",minWidth:0,overflowWrap:"anywhere"}}><span>{x.active?"公開":"下書き"}　{x.news_date}　{x.category}</span><br/><Link href={`/admin/poker-news?edit=${x.id}&page=${page}`}>{x.title}</Link></p><DeleteNewsButton id={x.id} title={x.title}/></div>)}<nav>{page>1&&<Link href={`/admin/poker-news?page=${page-1}`}>前へ</Link>}　{page} / {Math.max(1,Math.ceil((count||0)/30))}　{page*30<(count||0)&&<Link href={`/admin/poker-news?page=${page+1}`}>次へ</Link>}</nav></section></div>;
}

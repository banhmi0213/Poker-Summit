import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {PortalHeader} from "@/app/portal-header";
import {PortalFooter} from "@/app/portal-footer";
import {BottomTabs} from "@/app/bottom-tabs";
export const metadata={title:"国内外大型大会 | Poker Summit"};
export default async function Page(){
 const db=await createClient();
 const [{data:{user}},{data,error}]=await Promise.all([db.auth.getUser(),db.from("major_tournaments").select("id,title,scope,location,venue,start_date,end_date").eq("active",true).order("start_date",{ascending:true,nullsFirst:false})]);
 return <div><PortalHeader userEmail={user?.email}/><main className="container" style={{paddingTop:24}}><Link href="/" className="breadcrumb">← TOPに戻る</Link><h1>国内外大型大会</h1><p className="muted">国内・海外の大型ポーカー大会の開催情報とスケジュール。</p>{error?<p className="err">大会情報を読み込めませんでした。時間をおいて再度お試しください。</p>:!data?.length?<p>大会情報は準備中です。</p>:data.map(e=><Link key={e.id} href={`/major-tournaments/${e.id}`} className="card" style={{display:"block",marginBottom:16}}><span className="badge outline">{e.scope}</span><h2>{e.title}</h2><p>{e.start_date||"開催日未定"}{e.end_date&&` 〜 ${e.end_date}`}</p><p className="muted">{[e.location,e.venue].filter(Boolean).join(" / ")}</p><span>詳細・スケジュールを見る →</span></Link>)}</main><PortalFooter/><BottomTabs/></div>;
}
import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {PortalHeader} from "@/app/portal-header";
import {PortalFooter} from "@/app/portal-footer";
import {BottomTabs} from "@/app/bottom-tabs";
export default async function Page({params}:{params:{id:string}}){
 if(!/^[0-9a-f-]{36}$/i.test(params.id))notFound();
 const db=await createClient();
 const [{data:{user}},{data:e,error}]=await Promise.all([db.auth.getUser(),db.from("major_tournaments").select("*").eq("id",params.id).eq("active",true).maybeSingle()]);
 if(error)throw new Error("大会情報を読み込めませんでした。");
 if(!e)notFound();
 const officialUrl=/^https?:\/\//i.test(e.official_url)?e.official_url:null;
 return <div><PortalHeader userEmail={user?.email}/><main className="container" style={{maxWidth:960,paddingTop:24}}><Link href="/major-tournaments" className="breadcrumb">← 国内外大型大会に戻る</Link><article><div className="card"><span className="badge outline">{e.scope}</span><h1>{e.title}</h1><p>開催期間：{e.start_date||"未定"}{e.end_date&&` 〜 ${e.end_date}`}</p>{e.location&&<p>国・地域：{e.location}</p>}{e.venue&&<p>会場：{e.venue}</p>}{e.description&&<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{e.description}</p>}{officialUrl&&<a href={officialUrl} className="btn" target="_blank" rel="noopener noreferrer">公式サイト →</a>}</div><section className="card" style={{marginTop:20}}><h2>スケジュール</h2><p className="muted small">時刻は開催地の現地時間です。</p><p style={{whiteSpace:"pre-wrap",lineHeight:1.9,overflowWrap:"anywhere"}}>{e.schedule}</p></section></article></main><PortalFooter/><BottomTabs/></div>;
}
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BlogEditor } from "./editor";
import type { BlogEntry } from "@/lib/blog";

export default async function AdminBlogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: admin } = user ? await supabase.rpc("is_admin") : { data: false };
  if (admin !== true) return <p className="err">運営権限がありません。</p>;
  const { data, error } = await supabase.from("blog_entries").select("*").order("created_at", { ascending:false });
  if (error) return <p className="err">記事を読み込めませんでした。再読み込みしてください。</p>;
  return <div style={{ maxWidth:1000 }}>
    <div style={{ display:"flex", gap:16, justifyContent:"space-between", alignItems:"center", marginBottom:16 }}><h1 style={{ fontSize:22 }}>BLOG管理</h1><Link className="btn" href="/blog">ブログページを見る →</Link></div>
    <p style={{ marginBottom:16 }}>画像と記事URLを登録すると、ブログページに表示されます。記事を読むと登録したURLへ移動します。</p>
    <section className="card"><h2 style={{ fontSize:18, marginBottom:16 }}>新規記事追加</h2><BlogEditor /></section>
    <h2 style={{ fontSize:18, margin:"24px 0 12px" }}>登録記事（{data?.length || 0}件）</h2>
    {!data?.length && <p>まだ記事は登録されていません。</p>}
    {(data as BlogEntry[] || []).map(entry => <details key={entry.id} className="card" style={{ marginBottom:12 }}>
      <summary style={{ cursor:"pointer", fontWeight:700 }}>{entry.active ? "公開中" : "非公開"}｜{entry.title} {entry.featured ? "［ピックアップ］" : ""}</summary>
      <div style={{ marginTop:16 }}><img src={entry.image_url} alt={entry.title} style={{ display:"block", width:280, maxWidth:"100%", height:"auto", marginBottom:16 }} /><BlogEditor entry={entry} /></div>
    </details>)}
  </div>;
}

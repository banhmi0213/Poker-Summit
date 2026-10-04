import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BlogEntry, BlogStore } from "@/lib/blog";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { ArticleContent } from "../article-content";
import styles from "../article.module.css";
export default async function BlogArticlePage({ params, searchParams }: { params:{id:string}; searchParams:{preview?:string} }) {
 if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
 const supabase = await createClient();
 const { data:{user} } = await supabase.auth.getUser();
 let preview = false;
 if (searchParams.preview === "1" && user) { const { data } = await supabase.rpc("is_admin"); preview = data === true; }
 let query = supabase.from("blog_entries").select("*").eq("id",params.id);
 if (!preview) query = query.eq("active",true);
 const {data,error} = await query.maybeSingle();
 if (error || !data) notFound();
 const entry = data as BlogEntry;
 let stores: BlogStore[] = [];
 if (entry.related_store_ids?.length) {
  const {data:found} = await supabase.from("stores").select("id,name,pref,city,banner_url").in("id",entry.related_store_ids).in("status",["approved","listed"]);
  stores = entry.related_store_ids.flatMap(id => (found || []).filter(s => s.id === id));
 }
 return <div className="portal"><PortalHeader userEmail={user?.email} /><main className={`${styles.page} detail-readable`}><Link href="/blog" className={styles.back}>← BLOG一覧に戻る</Link>{preview && <div className={styles.notice}>管理者プレビュー（{entry.active ? "公開中" : "下書き"}）　<Link href="/admin/blog">編集画面に戻る</Link></div>}<ArticleContent title={entry.title} category={entry.category} summary={entry.summary} image={entry.image_url} body={Array.isArray(entry.body) ? entry.body : []} stores={stores} />{entry.content_mode === "external" && entry.article_url && <p><a href={entry.article_url} className={styles.back}>外部の記事を読む →</a></p>}</main><PortalFooter /><BottomTabs /></div>;
}

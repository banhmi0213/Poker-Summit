import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BlogEntry, BlogStore } from "@/lib/blog";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { ArticleContent } from "../article-content";
import styles from "../article.module.css";
export async function generateMetadata({ params, searchParams }: { params: { id: string }; searchParams: { preview?: string } }): Promise<Metadata> {
 if (searchParams.preview === "1") return { robots: { index: false, follow: false } };
 const supabase = await createClient();
 const byId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
 const metaQuery=supabase.from("blog_entries").select("title,summary,meta_description,seo_title,canonical_url,search_index,slug").eq("active",true);
 const { data, error } = await (byId?metaQuery.eq("id",params.id):metaQuery.eq("slug",params.id)).maybeSingle();
 if (error || !data) return { robots: { index: false, follow: false } };
 return { title: data.seo_title?.trim() || `${data.title} | Poker Summit`, description: data.meta_description?.trim() || data.summary?.trim() || undefined, alternates:{canonical:data.canonical_url || `/blog/${data.slug || params.id}`}, robots:{index:data.search_index !== false,follow:true} };
}
export default async function BlogArticlePage({ params, searchParams }: { params:{id:string}; searchParams:{preview?:string} }) {
 const supabase = await createClient();
 const { data:{user} } = await supabase.auth.getUser();
 let preview = false;
 if (searchParams.preview === "1" && user) { const { data } = await supabase.rpc("is_admin"); preview = data === true; }
 const byId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
 let query = supabase.from("blog_entries").select("*");
 query=byId?query.eq("id",params.id):query.eq("slug",params.id);
 if (!preview) query = query.eq("active",true);
 const {data,error} = await query.maybeSingle();
 if (error || !data) notFound();
 const entry = data as BlogEntry;
 let stores: BlogStore[] = [];
 let relatedArticles: BlogEntry[] = [];
 if (entry.related_store_ids?.length) {
  const {data:found} = await supabase.from("stores").select("id,name,pref,city,banner_url").in("id",entry.related_store_ids).in("status",["approved","listed"]);
  stores = entry.related_store_ids.flatMap(id => (found || []).filter(s => s.id === id));
 }
 if(entry.related_article_ids?.length){
  let relatedQuery=supabase.from("blog_entries").select("*").in("id",entry.related_article_ids);
  if(!preview) relatedQuery=relatedQuery.eq("active",true);
  const {data:found}=await relatedQuery;
  relatedArticles=entry.related_article_ids.flatMap(id=>(found||[]).filter(a=>a.id===id)) as BlogEntry[];
 }
 return <div className="portal"><PortalHeader userEmail={user?.email} /><main className={`${styles.page} detail-readable`}>{entry.show_breadcrumbs !== false && <nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link> › <Link href="/blog">BLOG</Link> › <span>{entry.category}</span> › <span>{entry.title}</span></nav>}<Link href="/blog" className={styles.back}>← BLOG一覧に戻る</Link>{preview && <div className={styles.notice}>管理者プレビュー（{entry.active ? "公開中" : "下書き"}）　<Link href="/admin/blog">編集画面に戻る</Link></div>}<ArticleContent title={entry.title} category={entry.category} summary={entry.summary} image={entry.image_url} imageAlt={entry.image_alt} body={Array.isArray(entry.body) ? entry.body : []} stores={stores} authorName={entry.author_name} authorProfile={entry.author_profile} publishedAt={entry.published_at || entry.created_at} updatedAt={entry.published_at && entry.updated_at && new Date(entry.updated_at).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"}) !== new Date(entry.published_at).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"}) ? entry.updated_at : undefined} showToc={entry.show_toc !== false} references={entry.reference_sources || []} imageRights={entry.image_rights || ""} />{relatedArticles.length>0&&<section className={styles.relatedArticles}><h2>関連記事</h2>{relatedArticles.map(a=><Link key={a.id} href={`/blog/${a.slug||a.id}`}><span>{a.category}</span><strong>{a.title}</strong></Link>)}</section>}{entry.content_mode === "external" && entry.article_url && <p><a href={entry.article_url} className={styles.back}>外部の記事を読む →</a></p>}</main><PortalFooter /><BottomTabs /></div>;
}

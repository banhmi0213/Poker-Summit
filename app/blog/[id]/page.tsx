import { getVisitorId, isStaffDevice } from "@/lib/visitor";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { classifyDevice, isBotUserAgent } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import type { BlogEntry, BlogStore } from "@/lib/blog";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { ArticleContent } from "../article-content";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGES, SITE_NAME } from "@/lib/seo";
import styles from "../article.module.css";
import { TournamentPost } from "../tournament-post";
import postStyles from "../tournament-post.module.css";
export async function generateMetadata({ params, searchParams }: { params: { id: string }; searchParams: { preview?: string } }): Promise<Metadata> {
 if (searchParams.preview === "1") return { robots: { index: false, follow: false } };
 const supabase = await createClient();
 const byId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
 const metaQuery=supabase.from("blog_entries").select("title,summary,meta_description,seo_title,canonical_url,search_index,slug,image_url,image_alt").eq("active",true);
 const { data, error } = await (byId?metaQuery.eq("id",params.id):metaQuery.eq("slug",params.id)).maybeSingle();
 if (error || !data) return { robots: { index: false, follow: false } };
 const title=data.seo_title?.trim() || `${data.title}｜Poker Summit`;
 const description=data.meta_description?.trim() || data.summary?.trim() || undefined;
 const path=`/blog/${data.slug || params.id}`;
 const images=data.image_url?[{url:data.image_url,alt:data.image_alt||data.title}]:DEFAULT_OG_IMAGES;
 return { title, description, alternates:{canonical:data.canonical_url || path}, robots:{index:data.search_index !== false,follow:true},
  openGraph:{title,description,url:path,siteName:SITE_NAME,locale:"ja_JP",type:"article",images},
  twitter:{card:"summary_large_image",title,description,images:[data.image_url||DEFAULT_OG_IMAGE]} };
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
 // Public views only: admin previews should not inflate BLOG analytics.
 const viewHdrs = await headers();
 if (!preview && !isBotUserAgent(viewHdrs.get("user-agent")) && !isStaffDevice()) {
  const hdrs = viewHdrs;
  const referrer = hdrs.get("referer") ?? null;
  const device = classifyDevice(hdrs.get("user-agent"));
  supabase.from("page_views").insert({
   path: `/blog/${entry.slug || entry.id}`,
   blog_entry_id: entry.id,
   referrer,
   device,
   visitor_id: getVisitorId(),
  }).then(() => {});
 }
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
 const hasTournamentPost = !!entry.x_post_url;
 return <div className="portal"><PortalHeader userEmail={user?.email} /><main className={`${styles.page} ${hasTournamentPost ? postStyles.wide : ""} detail-readable`}>{entry.show_breadcrumbs !== false && <nav className={styles.breadcrumb} aria-label="パンくず"><Link href="/">TOP</Link> › <Link href="/blog">BLOG</Link> › <span>{entry.category}</span> › <span>{entry.title}</span></nav>}<Link href="/blog" className={styles.back}>BLOG一覧に戻る</Link>{preview && <div className={styles.notice}>管理者プレビュー（{entry.active ? "公開中" : "下書き"}）　<Link href="/admin/blog">編集画面に戻る</Link></div>}<div className={hasTournamentPost ? postStyles.layout : undefined}><ArticleContent title={entry.title} category={entry.category} summary={entry.summary} image={entry.image_url} imageAlt={entry.image_alt} body={Array.isArray(entry.body) ? entry.body : []} stores={stores} authorName={entry.author_name} authorProfile={entry.author_profile} publishedAt={entry.published_at || entry.created_at} updatedAt={entry.published_at && entry.updated_at && new Date(entry.updated_at).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"}) !== new Date(entry.published_at).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"}) ? entry.updated_at : undefined} showToc={entry.show_toc !== false} references={entry.reference_sources || []} imageRights={entry.image_rights || ""} articleSlug={entry.slug || ""} />{hasTournamentPost && <TournamentPost key={entry.x_post_url} url={entry.x_post_url || ""} />}</div>{relatedArticles.length>0&&<section className={styles.relatedArticles}><h2>関連記事</h2>{relatedArticles.map(a=><Link key={a.id} href={`/blog/${a.slug||a.id}`}><span>{a.category}</span><strong>{a.title}</strong></Link>)}</section>}{entry.content_mode === "external" && entry.article_url && <p><a href={entry.article_url} className={styles.back}>外部の記事を読む</a></p>}</main><PortalFooter /><BottomTabs /></div>;
}

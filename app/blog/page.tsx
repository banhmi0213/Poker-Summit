import { staticPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BLOG_CATEGORIES, blogArticleHref, type BlogEntry } from "@/lib/blog";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import styles from "./blog.module.css";

export const metadata = staticPageMetadata({ title: "BLOG（ポーカー初心者ガイド・店舗紹介・大会レポート）", description: "店舗紹介・大会レポート・初心者ガイド。ポーカーの楽しみ方が、もっと広がる。", path: "/blog" });
type Params = { category?: string; q?: string; page?: string; sort?: string };
function href(params: Params, change: Partial<Params>) {
  const query = new URLSearchParams();
  Object.entries({ ...params, ...change }).forEach(([key,value]) => { if (value) query.set(key,value); });
  return `/blog${query.size ? `?${query}` : ""}`;
}
function Article({ entry, featured = false }: { entry: BlogEntry; featured?: boolean }) {
  return <a href={blogArticleHref(entry)} className={featured ? styles.featured : styles.article}>
    <div className={styles.photo}><img src={entry.image_url} alt={entry.image_alt || entry.title} loading="lazy" /></div>
    <div className={styles.copy}><span className={styles.badge}>{entry.category}</span><h3>{entry.title}</h3>{entry.summary && <p>{entry.summary}</p>}<div className={styles.meta}><time>{new Date(entry.created_at).toLocaleDateString("ja-JP", { timeZone:"Asia/Tokyo" })}</time><strong>記事を読む →</strong></div></div>
  </a>;
}
export default async function BlogPage({ searchParams }: { searchParams: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const category = BLOG_CATEGORIES.find(c => c === searchParams.category) || "";
  const q = (searchParams.q || "").trim().slice(0,100);
  const sort = searchParams.sort === "oldest" ? "oldest" : "newest";
  const requested = Math.min(10000,Math.max(1,Number.parseInt(searchParams.page || "1",10) || 1));
  const params: Params = { category, q, sort };
  function filtered() {
    let query = supabase.from("blog_entries").select("*", { count:"exact" }).eq("active",true);
    if (category) query = query.eq("category",category);
    if (q) query = query.ilike("title",`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    return query;
  }
  const { count, error: countError } = await filtered().limit(0);
  const pages = Math.max(1,Math.ceil((count || 0)/6));
  const page = Math.min(requested,pages);
  const { data: entries, error } = await filtered().order("created_at",{ ascending:sort === "oldest" }).order("id").range((page-1)*6,page*6-1);
  let pickup = supabase.from("blog_entries").select("*").eq("active",true).eq("featured",true);
  if (category) pickup = pickup.eq("category",category);
  const { data: featured } = q ? { data:null } : await pickup.order("updated_at",{ ascending:false }).limit(1).maybeSingle();
  return <div className="portal"><PortalHeader userEmail={user?.email} />
    <main className={styles.page}>
      <div className={styles.back}><Link href="/">← TOPに戻る</Link></div>
      <section className={styles.hero}><div className={styles.heroCopy}><span>POKER SUMMIT BLOG</span><h1>ポーカーの楽しみ方が、<br />もっと広がる。</h1><p>店舗紹介・大会レポート・初心者ガイド</p></div><div className={styles.heroPhoto}><picture><source media="(max-width:599px)" srcSet="/images/blog-magazine-mobile.jpg" /><img src="/images/blog-magazine-photo.jpg" alt="ポーカー店舗を紹介する開いた雑誌とチップ、トランプ" width="2172" height="724" /></picture></div></section>
      <div className={styles.toolbar}>
        <nav aria-label="記事カテゴリ"><Link href={href(params,{ category:"",page:"" })} aria-current={!category ? "page" : undefined}>すべて</Link>{BLOG_CATEGORIES.map(c => <Link key={c} href={href(params,{ category:c,page:"" })} aria-current={category === c ? "page" : undefined}>{c}</Link>)}</nav>
        <form action="/blog" method="get"><input type="hidden" name="category" value={category} /><input name="q" defaultValue={q} placeholder="記事を検索" aria-label="記事を検索" /><button type="submit" aria-label="検索する">検索</button></form>
      </div>
      {featured && <section className={styles.section}><h2>ピックアップ</h2><Article entry={featured as BlogEntry} featured /></section>}
      <section className={styles.section}>
        <div className={styles.sectionHead}><h2>{q ? "検索結果" : "新着記事"}</h2><div><Link href={href(params,{sort:sort === "newest" ? "oldest" : "newest",page:""})}>{sort === "newest" ? "新着順" : "古い順"} ↕</Link></div></div>
        {error || countError ? <p role="alert">記事を読み込めませんでした。再読み込みしてください。</p> : !entries?.length ? <div className={styles.empty}>{category || q ? "条件に合う記事はありません。" : "記事はただいま準備中です。"}</div> : <div className={styles.grid}>{(entries as BlogEntry[]).map(e => <Article key={e.id} entry={e} />)}</div>}
        {pages > 1 && <nav className={styles.pagination} aria-label="ページ切り替え">{page > 1 && <Link href={href(params,{page:String(page-1)})}>← 前へ</Link>}<span>{page} / {pages}</span>{page < pages && <Link href={href(params,{page:String(page+1)})}>次へ →</Link>}</nav>}
      </section>
      <div className={styles.bottom}><Link href="/blog?category=初心者ガイド"><strong>初めての方はこちら</strong><span>初心者ガイドを見る →</span></Link><Link href="/stores">店舗を探す →</Link><Link href="/events">イベントを探す →</Link></div>
    </main><PortalFooter /><BottomTabs />
  </div>;
}

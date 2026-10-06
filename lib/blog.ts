export const BLOG_CATEGORIES = ["店舗紹介", "大会レポート", "初心者ガイド"] as const;
export type BlogBlock = {
 type: "paragraph" | "heading" | "heading3" | "image" | "list" | "table";
 text?: string; url?: string; path?: string; caption?: string; alt?: string; uploadKey?: string;
 items?: string[]; ordered?: boolean; rows?: string[][];
};
export type BlogStore = { id: string; name: string; pref: string | null; city: string | null; banner_url: string | null };
export type BlogEntry = {
 id: string; title: string; summary: string; category: string;
 slug?: string | null; seo_title?: string; meta_description?: string; canonical_url?: string | null; search_index?: boolean;
 author_name?: string; author_profile?: string; published_at?: string | null; updated_at?: string; created_at: string;
 article_url: string | null; image_url: string; image_path: string; image_alt?: string; image_rights?: string;
 content_mode: "internal" | "external"; body: BlogBlock[]; related_store_ids: string[]; related_article_ids?: string[];
 show_toc?: boolean; show_breadcrumbs?: boolean; include_in_sitemap?: boolean; visibility?: "draft"|"published"|"private"; reference_sources?: {label:string;url?:string}[];
 active: boolean; featured: boolean;
};
export function blogArticleHref(entry: Pick<BlogEntry,"id" | "slug" | "content_mode" | "article_url">) {
 return entry.content_mode === "internal" ? `/blog/${entry.slug || entry.id}` : entry.article_url || `/blog/${entry.slug || entry.id}`;
}
export function blogHeadingId(text:string,index:number) {
 const normalized=text.toLowerCase().trim().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff-]+/g,"-").replace(/^-+|-+$/g,"");
 return normalized || `section-${index+1}`;
}

export const BLOG_CATEGORIES = ["店舗紹介", "大会レポート", "初心者ガイド"] as const;
export type BlogBlock = { type: "paragraph" | "heading" | "image"; text?: string; url?: string; path?: string; caption?: string; alt?: string; uploadKey?: string };
export type BlogStore = { id: string; name: string; pref: string | null; city: string | null; banner_url: string | null };
export type BlogEntry = {
  id: string; title: string; summary: string; category: string;
  meta_description?: string; article_url: string | null; image_url: string; image_path: string; image_alt?: string;
  content_mode: "internal" | "external"; body: BlogBlock[]; related_store_ids: string[];
  active: boolean; featured: boolean; created_at: string;
};
export function blogArticleHref(entry: Pick<BlogEntry,"id" | "content_mode" | "article_url">) {
 return entry.content_mode === "internal" ? `/blog/${entry.id}` : entry.article_url || `/blog/${entry.id}`;
}

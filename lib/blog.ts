export const BLOG_CATEGORIES = ["店舗紹介", "大会レポート", "初心者ガイド"] as const;
export type BlogEntry = {
  id: string; title: string; summary: string; category: string;
  article_url: string; image_url: string; image_path: string;
  active: boolean; featured: boolean; created_at: string;
};

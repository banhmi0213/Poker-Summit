import type { Metadata } from "next";

export const SITE_NAME = "Poker Summit";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://pokersummit.jp").replace(/\/$/, "");
export const SITE_TAGLINE = "全国のアミューズメントポーカー店・ポーカーバー検索";
export const SITE_DESCRIPTION =
  "全国のアミューズメントポーカー店・ポーカーバーを都道府県や駅から探せるポータルサイト。営業時間・アクセス・トーナメント・イベント・求人・クーポン情報をまとめてチェックできます。";

/** SNSで共有されたときの既定の画像(写真のないページ用) */
export const DEFAULT_OG_IMAGE = "/og-default.jpg";
export const DEFAULT_OG_IMAGES = [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }];

/** "ページ名｜Poker Summit" の形に揃える */
export function pageTitle(name: string) {
  return `${name}｜${SITE_NAME}`;
}

/** 改行・連続スペースを畳み、max 文字で切る(検索結果の説明文向け) */
export function clip(text: string | null | undefined, max = 120) {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 静的ページ用: タイトル・説明・canonical・OGPをまとめて作る */
export function staticPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const title = pageTitle(opts.title);
  return {
    title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: { title, description: opts.description, url: opts.path, siteName: SITE_NAME, locale: "ja_JP", type: "website", images: DEFAULT_OG_IMAGES },
    twitter: { card: "summary_large_image", title, description: opts.description, images: [DEFAULT_OG_IMAGE] },
    ...(opts.index === false ? { robots: { index: false, follow: true } } : {}),
  };
}

/** ログイン後の画面など、検索結果に出す必要のないページ */
export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

/** JSON-LD を <script> に埋め込むための安全な文字列化(</script> 混入対策) */
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

import { normalizeXPostUrl } from "./x-post";
import { BLOG_CATEGORIES, type BlogBlock, type BlogEntry } from "./blog";

export type BlogImportResult = { draft: Partial<BlogEntry>; warnings: string[] };
export const BLOG_IMPORT_MAX_LENGTH = 150000;
type Row = Record<string, unknown>;
function record(value: unknown, label: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}の形式を確認してください。`);
  return value as Row;
}
function text(value: unknown, label: string, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`${label}は${required ? "空欄にせず、" : ""}${max}文字以内で指定してください。`);
  return value.trim();
}
function bool(value: unknown, label: string) {
  if (value === undefined) return true;
  if (typeof value !== "boolean") throw new Error(`${label}には true または false を指定してください。`);
  return value;
}
function url(value: unknown, label: string) {
  const raw = text(value, label, 2048, true);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error(`${label}に正しいURLを指定してください。`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(`${label}には http:// または https:// のURLを指定してください。`);
  return parsed.href;
}

// A whitelist, not a spread of untrusted JSON: no ID, publication status,
// stored image path or remote image URL can be imported into the editor.
export function parseBlogImport(raw: string, articles: Pick<BlogEntry, "id" | "slug" | "title" | "active">[] = []): BlogImportResult {
  if (raw.length > BLOG_IMPORT_MAX_LENGTH) throw new Error("記事データは15万文字以内にしてください。");
  let source = raw.replace(/^\uFEFF/, "").trim();
  const fenced = source.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) source = fenced[1];
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("JSON形式を読み取れませんでした。記事データ全体を貼り付けてください。"); }
  const data = record(parsed, "記事データ");
  if (data.version !== 1) throw new Error("記事データの version は 1 を指定してください。");
  const title = text(data.title, "タイトル", 160, true);
  const slug = text(data.slug, "スラッグ", 120, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("スラッグは半角小文字の英数字とハイフンで指定してください。");
  if (articles.some(article => article.slug === slug)) throw new Error("同じスラッグの記事が登録済みです。別のスラッグを指定してください。既存記事は上書きしません。");
  const category = text(data.category, "カテゴリ", 100, true);
  if (!BLOG_CATEGORIES.some(c => c === category)) throw new Error("管理画面にあるカテゴリ名を指定してください。");
  if (!Array.isArray(data.body) || !data.body.length || data.body.length > 100 || JSON.stringify(data.body).length > 120000) throw new Error("本文は1〜100ブロック、合計12万文字以内にしてください。");
  const body: BlogBlock[] = data.body.map((value, i) => {
    const block = record(value, `本文${i + 1}`);
    if (block.type === "paragraph" || block.type === "heading" || block.type === "heading3") {
      return { type: block.type, text: text(block.text, `本文${i + 1}`, block.type === "paragraph" ? 20000 : 200, true) };
    }
    if (block.type === "image") return { type: "image", alt: text(block.alt, "本文画像ALT", 300), caption: text(block.caption, "本文画像の説明", 300) };
    if (block.type === "list") {
      if (!Array.isArray(block.items) || !block.items.length || block.items.length > 200) throw new Error("箇条書きは1〜200項目にしてください。");
      if (block.ordered !== undefined && typeof block.ordered !== "boolean") throw new Error("リストの ordered には true または false を指定してください。");
      return { type: "list", ordered: block.ordered === true, items: block.items.map(v => text(v, "箇条書き", 2000, true)) };
    }
    if (block.type === "table") {
      if (!Array.isArray(block.rows) || !block.rows.length || block.rows.length > 100) throw new Error("表は1〜100行にしてください。");
      const rows: string[][] = block.rows.map(row => {
        if (!Array.isArray(row) || !row.length || row.length > 20) throw new Error("表は1〜20列にしてください。");
        return row.map(v => text(v, "表のセル", 2000));
      });
      if (rows.some(row => row.length !== rows[0].length)) throw new Error("表の列数をそろえてください。");
      return { type: "table", rows };
    }
    throw new Error(`本文${i + 1}に未対応のブロック形式があります。`);
  });
  if (!body.some(b => b.text || b.items?.length || b.rows?.length)) throw new Error("本文に文章・見出し・リスト・表のいずれかを指定してください。");
  const warnings: string[] = [];
  const references = data.references ?? [];
  if (!Array.isArray(references) || references.length > 30) throw new Error("参考資料は30件以内にしてください。");
  const reference_sources = references.map(value => {
    const source = record(value, "参考資料");
    return { label: text(source.label, "資料名", 300, true), ...(source.url ? { url: url(source.url, "参考資料URL") } : {}) };
  });
  const related = data.relatedArticles ?? [];
  if (!Array.isArray(related) || related.length > 12) throw new Error("関連記事は12件以内にしてください。");
  const related_article_ids = [...new Set(related.flatMap(value => {
    const key = text(value, "関連記事のスラッグ・ID・タイトル", 160, true);
    const matches = articles.filter(a => a.active && (a.id === key || a.slug === key || a.title === key));
    if (matches.length !== 1) { warnings.push(`関連記事「${key}」は公開記事を一意に特定できないため選択しませんでした。`); return []; }
    return [matches[0].id];
  }))];
  return { warnings, draft: {
    title, slug, category, summary: text(data.summary, "サブタイトル", 600),
    seo_title: text(data.seoTitle, "SEOタイトル", 160), meta_description: text(data.metaDescription, "メタディスクリプション", 300),
    author_name: text(data.authorName, "著者", 120), author_profile: text(data.authorProfile, "著者プロフィール", 1000),
    image_alt: text(data.imageAlt, "メイン画像ALT", 300), image_rights: text(data.imageRights, "画像の権利情報", 1000),
    x_post_url: normalizeXPostUrl(text(data.xPostUrl, "X投稿URL", 2048)),
    body, reference_sources, related_article_ids, related_store_ids: [],
    show_toc: bool(data.showToc, "目次"), show_breadcrumbs: bool(data.showBreadcrumbs, "パンくず"),
    search_index: bool(data.searchIndex, "検索登録"), include_in_sitemap: bool(data.includeInSitemap, "サイトマップ"),
    content_mode: "internal", visibility: "draft", active: false, featured: false,
    published_at: null, canonical_url: "", image_url: "", image_path: "",
  } };
}

export const BLOG_IMPORT_EXAMPLE = {
  version: 1,
  title: "ポーカー店への初来店｜受付で伝えたいこと",
  slug: "first-poker-room-reception",
  category: "初心者ガイド",
  summary: "初めてのポーカー店で、受付時に確認しておきたいことを紹介します。",
  seoTitle: "ポーカー店が初めての方へ｜受付での伝え方と確認事項",
  metaDescription: "初めてポーカー店を訪れる方に向けて、初心者講習、料金、滞在時間について受付で確認するポイントを紹介します。",
  imageAlt: "ポーカーテーブルと受付をイメージしたイラスト",
  body: [
    { type: "paragraph", text: "初来店では、受付で「初めてです」と伝えることから始めましょう。ルールに不安がある場合は、初心者講習があるか確認すると安心です。" },
    { type: "heading", text: "受付で確認したい3つのこと" },
    { type: "list", items: ["参加にかかる合計料金と追加費用", "初心者講習の有無と開始時間", "遊べる形式と必要な滞在時間"] },
    { type: "heading3", text: "分からないことは着席前に聞く" },
    { type: "paragraph", text: "料金や進行方法は店舗によって異なります。予算と帰りたい時間を伝えて、自分に合う遊び方をスタッフに相談してください。" },
    { type: "image", alt: "卓上に並んだポーカーチップ", caption: "ここに手動で画像を登録してください。不要なら写真ブロックを削除できます。" },
    { type: "table", rows: [["確認する項目", "聞き方の例"], ["合計料金", "初めての場合、全部でいくらかかりますか？"], ["講習", "ルール説明を受けられますか？"]] },
  ],
  relatedArticles: [], references: [], showToc: true, showBreadcrumbs: true,
};

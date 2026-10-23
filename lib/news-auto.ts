import "server-only";
import { randomUUID } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseBlogImport } from "@/lib/blog-import";
import { renderNewsCard } from "@/lib/news-card";
import type { BlogEntry } from "@/lib/blog";

// ============================================================================
// ポーカーのニュースを自動で集めて、BLOGの下書きにする(2026/10/23 オーナー指示)。
//  - AI(Claude API + Web検索)が直近のニュースを探し、実際に読んだ記事だけを元に、
//    日本語の自分の文章で記事を書く(元の文章は写さない。出典のURLを必ず付ける)。
//  - 集める範囲: 国内の大会・ポーカー界 / 海外の大型大会 / 業界・ルール・法律。
//  - 公開はしない。下書き(active=false)で保存し、運営が確認してから公開する。
//  - 画像: 大会の公式が報道用の利用を認めている写真だけ使う(出典と許可の内容を image_rights に残す)。
//    それ以外はサイトの色でタイトル入りの画像を作る(lib/news-card.tsx)。
//  - 一度記事にしたニュース(元記事のURL)は news_auto_items に残し、二度と書かない。
// 必要な設定: ANTHROPIC_API_KEY(Vercelの環境変数)。モデルは NEWS_AI_MODEL で変えられる。
// ============================================================================

const MODEL = process.env.NEWS_AI_MODEL || "claude-sonnet-5-5";
const AUTHOR = "Poker Summit編集部";
const CATEGORIES = ["ポーカーニュース", "大会レポート"] as const;

type AiArticle = {
  skip?: string;
  sourceUrl?: string;
  officialImage?: { url?: string; pageUrl?: string; permission?: string } | null;
  [key: string]: unknown;
};

export type NewsDraftResult = { created: { title: string; id: string }[]; skipped: string[]; error?: string };

function jstDate() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function prompt(today: string, covered: string[], recentTitles: string[]) {
  return `あなたは日本のポーカー情報サイト「Poker Summit」の編集者です。今日は${today}(日本時間)です。
Web検索で、直近7日以内に出たポーカーのニュースを探し、その中から1本だけ選んで、日本語のニュース記事を書いてください。

探す範囲(どれか1本):
- 国内の大会・ポーカー界(JOPTなど国内の大型大会、国内のポーカー関連の話題)
- 海外の大型大会(WSOP、WPT、EPT、APTなどの結果、日本人の活躍)
- 業界・ルール・法律(アミューズメントポーカーに関わる規制や業界の動き)

必ず最初に確認する情報源(ここに新しいお知らせがあれば、最優先で記事にする):
- 一般社団法人日本ポーカー事業者連盟(JPBA)の公式HPのNEWS https://jpba-poker.com/ (公式X @JPBA_2025 と同じ内容が載る。店舗運用ガイドライン・警察庁とのやりとりなど、店舗と業界に直接関わる発表)
- JOPT(Japan Open Poker Tour)の公式サイトのお知らせ

すでに記事にしたニュース(この元記事は選ばない):
${covered.length ? covered.map((u) => `- ${u}`).join("\n") : "- なし"}
最近書いた記事のタイトル(同じ話題は選ばない):
${recentTitles.length ? recentTitles.map((t) => `- ${t}`).join("\n") : "- なし"}

守ること:
- 検索で実際に読んだ記事に書いてあることだけを書く。数字・名前・日付・賞金は元記事のとおりにし、分からないことは書かない。推測や作った発言は入れない。
- 元記事の文章をそのまま写さない。要点を自分の言葉でまとめる。
- 日本の法律で違法なオンラインカジノ・賭博サイトを紹介したり、勧めたりしない。
- 800〜1500文字。最初の段落で何があったかを書き、見出しを2〜3個入れる。
- 7日以内の確かなニュースが見つからないときは、記事を書かずに {"skip":"理由"} だけを返す。

画像について:
- 大会の公式サイトなどが「報道・メディアでの利用を認める」とはっきり書いている写真があれば、その画像のURL・載っていたページのURL・許可の内容を officialImage に入れる。
- はっきり書いていない写真は使わない(officialImage は null)。

最後に、次のJSONだけを返す(前後に説明を書かない):
{
  "version": 1,
  "title": "記事タイトル(40文字前後)",
  "slug": "半角小文字の英数字とハイフン",
  "category": "${CATEGORIES.join("」か「")}",
  "summary": "サブタイトル(80文字以内)",
  "seoTitle": "検索結果に出すタイトル",
  "metaDescription": "検索結果に出す説明(120文字前後)",
  "imageAlt": "メイン画像の説明",
  "body": [{"type":"paragraph","text":"..."},{"type":"heading","text":"..."},{"type":"list","items":["..."]}],
  "references": [{"label":"媒体名・記事名","url":"https://..."}],
  "sourceUrl": "いちばんの元記事のURL",
  "officialImage": null
}`;
}

function extractJson(text: string): AiArticle | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(raw) as AiArticle;
  } catch {
    return null;
  }
}

async function askAi(apiKey: string, content: string): Promise<AiArticle | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(240000),
  });
  if (!res.ok) throw new Error(`AI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  return extractJson(text);
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; ext: string; mime: string } | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) return null;
    const b = Buffer.from(bytes);
    const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
    const webp = b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpg && !webp) return null;
    return { bytes, ext: png ? "png" : jpg ? "jpg" : "webp", mime: png ? "image/png" : jpg ? "image/jpeg" : "image/webp" };
  } catch {
    return null;
  }
}

/** ニュースの下書きを最大 count 本作る */
export async function createNewsDrafts(count = 2): Promise<NewsDraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { created: [], skipped: [], error: "ANTHROPIC_API_KEY が設定されていません(Vercelの環境変数に追加してください)" };
  const svc = createServiceRoleClient();
  const created: { title: string; id: string }[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < count; i++) {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data: coveredRows } = await svc.from("news_auto_items").select("source_url").gte("created_at", since);
    const covered = (coveredRows ?? []).map((r: { source_url: string }) => r.source_url);
    const { data: articles } = await svc.from("blog_entries").select("id,slug,title,active,category,created_at").order("created_at", { ascending: false }).limit(300);
    const recentTitles = (articles ?? []).filter((a: { category: string }) => (CATEGORIES as readonly string[]).includes(a.category)).slice(0, 30).map((a: { title: string }) => a.title);

    let ai: AiArticle | null;
    try {
      ai = await askAi(apiKey, prompt(jstDate(), covered, recentTitles));
    } catch (e) {
      return { created, skipped, error: e instanceof Error ? e.message : "AIの呼び出しに失敗しました" };
    }
    if (!ai) { skipped.push("AIの返事を読み取れなかった"); continue; }
    if (ai.skip) { skipped.push(`AIが書かなかった: ${ai.skip}`); break; }
    const sourceUrl = typeof ai.sourceUrl === "string" ? ai.sourceUrl.trim() : "";
    if (!/^https?:\/\//.test(sourceUrl)) { skipped.push(`元記事のURLがない: ${String(ai.title ?? "")}`); continue; }
    if (covered.includes(sourceUrl)) { skipped.push(`記事にしたことのあるニュース: ${sourceUrl}`); continue; }

    // スラッグがかぶらないよう日付を付ける。形式・カテゴリ・本文は手動の取り込みと同じチェックを通す
    const slugBase = String(ai.slug ?? "poker-news").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "poker-news";
    ai.slug = `${slugBase}-${jstDate().replace(/-/g, "")}`;
    if (!(CATEGORIES as readonly string[]).includes(String(ai.category))) ai.category = CATEGORIES[0];
    ai.authorName = AUTHOR;
    let parsed;
    try {
      parsed = parseBlogImport(JSON.stringify(ai), (articles ?? []) as Pick<BlogEntry, "id" | "slug" | "title" | "active">[]);
    } catch (e) {
      skipped.push(`記事の形式が正しくない(${e instanceof Error ? e.message : ""}): ${String(ai.title ?? "")}`);
      continue;
    }
    const draft = parsed.draft;
    if (!draft.reference_sources?.some((r) => r.url)) { skipped.push(`出典のURLがない: ${draft.title}`); continue; }

    // 画像: 報道用の利用が明記された公式写真 → なければタイトル入り画像
    let image: { bytes: Uint8Array; ext: string; mime: string } | null = null;
    let imageRights = "";
    const official = ai.officialImage;
    if (official?.url && official.permission && official.pageUrl) {
      image = await downloadImage(official.url);
      if (image) imageRights = `出典: ${official.pageUrl}（${official.permission}）※AIが報道用の利用許可を確認。公開前に許可の内容を確認してください`;
    }
    if (!image) {
      const card = await renderNewsCard(draft.title ?? "", draft.category ?? CATEGORIES[0]);
      if (card) { image = { bytes: card, ext: "png", mime: "image/png" }; imageRights = "Poker Summitで作成（記事タイトル画像）"; }
    }
    let imagePath = "", imageUrl = "";
    if (image) {
      const path = `news/${randomUUID()}.${image.ext}`;
      const { error: upErr } = await svc.storage.from("blog-images").upload(path, image.bytes, { contentType: image.mime, upsert: false });
      if (!upErr) { imagePath = path; imageUrl = svc.storage.from("blog-images").getPublicUrl(path).data.publicUrl; }
    }

    const { data: saved, error } = await svc
      .from("blog_entries")
      .insert({ ...draft, image_url: imageUrl, image_path: imagePath, image_rights: imageRights, active: false, visibility: "draft", featured: false, published_at: null })
      .select("id")
      .single();
    if (error || !saved) {
      if (imagePath) await svc.storage.from("blog-images").remove([imagePath]);
      skipped.push(`下書きを保存できなかった(${error?.message ?? ""}): ${draft.title}`);
      continue;
    }
    await svc.from("news_auto_items").insert({ source_url: sourceUrl, title: draft.title, blog_entry_id: saved.id });
    created.push({ title: draft.title ?? "", id: saved.id });
  }
  return { created, skipped };
}

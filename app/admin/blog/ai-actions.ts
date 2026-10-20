"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { BLOG_CATEGORIES, type BlogBlock } from "@/lib/blog";
import { BLOG_AUDIENCES, BLOG_DRAFT_SCHEMA, FACTUAL_CATEGORIES, draftInstructions, parseEditorialSources, validateBlogDraft } from "@/lib/blog-ai";
import { saveBlogEntry } from "./actions";

export type AiDraftState = { error?: string; success?: string; id?: string };

async function openai(path: string, payload: object, timeout: number) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(timeout),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // Do not send provider error bodies or credentials to the browser or logs.
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("生成APIのキー・モデル利用権限を確認してください。");
    if (response.status === 429) throw new Error("生成APIの利用上限に達しました。APIの残高・制限を確認してください。");
    throw new Error("生成APIでエラーが発生しました。記事一覧を確認してから再度お試しください。");
  }
  return response.json();
}

export async function generateBlogDraft(_state: AiDraftState, formData: FormData): Promise<AiDraftState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "管理者ログインが必要です。" };
  const { data: admin, error: authError } = await supabase.rpc("is_admin");
  if (authError || admin !== true) return { error: "運営権限がありません。" };
  if (process.env.BLOG_AI_ENABLED !== "true" || !process.env.OPENAI_API_KEY) return { error: "AI下書き機能は未設定です。サーバーの生成API設定を確認してください。" };
  try {
    const audience = String(formData.get("audience") || "");
    const category = String(formData.get("category") || "");
    const topic = String(formData.get("topic") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const extraImages = Number(formData.get("extraImages"));
    if (!BLOG_AUDIENCES.some(a => a === audience) || !BLOG_CATEGORIES.some(c => c === category) || ![0, 1, 2].includes(extraImages) || topic.length > 300 || notes.length > 2000) {
      return { error: "読者層・カテゴリ・画像枚数・テーマの入力内容を確認してください。" };
    }
    const sources = parseEditorialSources(String(formData.get("sources") || "[]"));
    if (FACTUAL_CATEGORIES.includes(category) && !sources.length) return { error: "このカテゴリには公式資料のURLと確認した内容を1件以上入力してください。" };
    const { data: articles, error: articleError } = await supabase.from("blog_entries")
      .select("id,title,summary,category,active").order("created_at", { ascending: false }).limit(200);
    if (articleError) return { error: "既存記事を取得できませんでした。生成は開始していません。" };

    // A unique Storage insert is a cross-instance lock (no in-memory rate limit).
    // One generation site-wide per five-minute UTC slot; keep failed reservations
    // to prevent repeated paid calls. Locks are tiny valid PNGs because this
    // bucket permits image MIME types only; no account or article data is stored.
    const slot = Math.floor(Date.now() / 300000);
    const { error: lockError } = await supabase.storage.from("blog-images").upload(
      `ai-reservations/${slot}.png`,
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ZkAAAAASUVORK5CYII=", "base64"),
      { contentType: "image/png", upsert: false },
    );
    if (lockError) return { error: "現在生成中か、直近5分枠です。少し待ってください。続く場合はblog-imagesの保存権限を確認してください。" };

    const textModel = process.env.OPENAI_BLOG_TEXT_MODEL || "gpt-4.1";
    const imageModel = process.env.OPENAI_BLOG_IMAGE_MODEL || "gpt-image-1";
    const result = await openai("responses", {
      model: textModel, store: false, max_output_tokens: 10000,
      instructions: draftInstructions(),
      input: JSON.stringify({ audience, category, topic, notes, images: extraImages + 1, sources, existingArticles: articles }),
      text: { format: { type: "json_schema", name: "poker_summit_draft", strict: true, schema: BLOG_DRAFT_SCHEMA } },
    }, 90000);
    if (result.status !== "completed" || !Array.isArray(result.output)) throw new Error("記事生成が完了しませんでした。下書きは保存されていません。");
    const output = result.output.filter((x: { type?: string }) => x.type === "message")
      .flatMap((x: { content?: { type?: string; text?: string }[] }) => x.content || []);
    if (output.some((x: { type?: string }) => x.type === "refusal")) throw new Error("このテーマでは記事を生成できませんでした。テーマを変更してください。");
    const generatedText = output.filter((x: { type?: string }) => x.type === "output_text").map((x: { text?: string }) => x.text || "").join("");
    const publishedIds = (articles || []).filter(a => a.active).map(a => a.id);
    const draft = validateBlogDraft(JSON.parse(generatedText), publishedIds, extraImages + 1);
    const imageResults = await Promise.all(draft.images.map(async image => {
      const result = await openai("images/generations", {
        model: imageModel, prompt: image.prompt + "\nNo text, logos, card faces or factual diagrams. Editorial illustration only.",
        n: 1, size: "1536x1024", quality: "low", output_format: "webp", output_compression: 75,
      }, 150000);
      const base64 = result.data?.[0]?.b64_json;
      if (typeof base64 !== "string" || base64.length > 4200000) throw new Error("生成画像の容量が上限を超えました。下書きは保存されていません。");
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length > 3 * 1024 * 1024 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error("生成画像の形式を確認できませんでした。");
      return new File([bytes], `${randomUUID()}.webp`, { type: "image/webp" });
    }));
    const save = new FormData();
    // Server-owned policy: the model and submitted form cannot publish anything.
    const values = {
      title: draft.title, slug: `${draft.slug}-${randomUUID().slice(0, 8)}`, summary: draft.summary,
      category, seoTitle: draft.seoTitle, metaDescription: draft.metaDescription,
      contentMode: "internal", intent: "draft", visibility: "draft", imageAlt: draft.images[0].alt,
      authorName: "", authorProfile: "", canonicalUrl: "", publishedAt: "",
      imageRights: `OpenAI ${imageModel}によるAI生成イラスト。生成日：${new Date().toISOString()}。実在店舗・大会の記録写真ではありません。公開前に画像内容・ALT・権利を確認してください。`,
      references: JSON.stringify(sources.map(s => ({ label: `${s.label}（運営提供資料・AIによるURL閲覧なし）`, url: s.url }))),
      showToc: "on", showBreadcrumbs: "on", searchIndex: "on", includeInSitemap: "on",
    };
    Object.entries(values).forEach(([key, value]) => save.set(key, value));
    draft.relatedArticleIds.forEach(id => save.append("relatedArticleIds", id));
    save.set("image", imageResults[0]);
    const body: BlogBlock[] = [];
    draft.body.forEach((block, i) => {
      body.push(block);
      draft.images.slice(1).forEach((image, n) => {
        if (Math.max(0, image.afterBlock) !== i) return;
        const uploadKey = `ai_${n}`;
        body.push({ type: "image", uploadKey, alt: image.alt, caption: "AI生成イラスト" });
        save.set(`bodyImage_${uploadKey}`, imageResults[n + 1]);
      });
    });
    save.set("body", JSON.stringify(body));
    const saved = await saveBlogEntry({}, save);
    if (saved.error || !saved.id) return { error: saved.error || "下書きを保存できませんでした。" };
    // Save succeeded: never report a failed generation merely because audit fails.
    try {
      await logAdminAction(supabase, "blog_ai_draft", "blog", saved.id, { audience, category, textModel, imageModel, imageCount: imageResults.length });
    } catch { /* Existing blog_create audit is also recorded by saveBlogEntry. */ }
    return { id: saved.id, success: "画像・SEO設定を含む下書きを保存しました。登録記事を開き、本文・画像・出典を確認してから公開してください。" };
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) return { error: "生成が時間切れになりました。登録記事を確認してから再度お試しください。API利用料が発生している場合があります。" };
    if (error instanceof SyntaxError) return { error: "資料または生成結果の形式を読み取れませんでした。下書きは保存されていません。" };
    return { error: error instanceof Error ? error.message : "生成に失敗しました。登録記事をご確認ください。" };
  }
}

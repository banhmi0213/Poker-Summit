"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { BLOG_CATEGORIES } from "@/lib/blog";
import { BLOG_AUDIENCES, FACTUAL_CATEGORIES, type EditorialSource } from "@/lib/blog-ai";
import { generateBlogDraft } from "./ai-actions";

function GenerateButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return <><button className="btn primary" disabled={!enabled || pending}>{pending ? "記事・画像を生成しています…" : "AIで作成して下書き保存"}</button>
    {pending && <p role="status">生成には数分かかることがあります。この画面を閉じずにお待ちください。</p>}</>;
}

export function AiBlogGenerator({ enabled }: { enabled: boolean }) {
  const [state, action] = useFormState(generateBlogDraft, {});
  const [category, setCategory] = useState<string>(BLOG_CATEGORIES[0]);
  const [sources, setSources] = useState<EditorialSource[]>([]);
  function changeSource(index: number, key: keyof EditorialSource, value: string) {
    setSources(old => old.map((source, i) => i === index ? { ...source, [key]: value } : source));
  }
  return <section className="card" style={{ marginBottom: 24 }} aria-labelledby="ai-blog-heading">
    <h2 id="ai-blog-heading" style={{ fontSize: 18, marginBottom: 12 }}>AIで記事の下書きを作成</h2>
    <p>本文・画像・SEO設定・関連記事を作成して下書きに保存します。公開は内容を確認した後、記事の編集欄から行えます。</p>
    {!enabled && <p role="status">AI生成は未設定です。サーバーのAPI設定が完了すると利用できます。</p>}
    <form action={action}>
      <fieldset disabled={!enabled || !!state.id} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <label className="field">対象読者<select name="audience">{BLOG_AUDIENCES.map(a => <option key={a}>{a}</option>)}</select></label>
        <label className="field">カテゴリ<select name="category" value={category} onChange={e => setCategory(e.target.value)}>{BLOG_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="field">テーマ（空欄ならお任せ）<input name="topic" maxLength={300} placeholder="例：ポーカー店に初めて行く方の来店ガイド" /></label>
        <label className="field">記事に含めたい内容<textarea name="notes" rows={3} maxLength={2000} placeholder="例：料金の確認方法、受付の流れ、マナーを中心に解説" /></label>
        <label className="field">本文画像<select name="extraImages" defaultValue="1"><option value="0">なし（アイキャッチ1枚）</option><option value="1">1枚（合計2枚）</option><option value="2">2枚（合計3枚）</option></select></label>
        <p>{FACTUAL_CATEGORIES.includes(category) ? "このカテゴリは参考資料が必須です。" : "必要に応じて公式資料を追加できます。"} URL先の自動閲覧は行いません。公式情報で確認した内容を記載してください。</p>
        {sources.map((source, i) => <fieldset key={i} style={{ margin: "12px 0", padding: 12 }}><legend>参考資料 {i + 1}</legend>
          <label className="field">資料名<input required maxLength={200} value={source.label} onChange={e => changeSource(i, "label", e.target.value)} /></label>
          <label className="field">公式資料URL<input required type="url" maxLength={2048} value={source.url} onChange={e => changeSource(i, "url", e.target.value)} placeholder="https://..." /></label>
          <label className="field">確認した内容・確認日<textarea required rows={4} maxLength={4000} value={source.excerpt} onChange={e => changeSource(i, "excerpt", e.target.value)} /></label>
          <button className="btn" type="button" onClick={() => setSources(old => old.filter((_, n) => n !== i))}>この資料を外す</button>
        </fieldset>)}
        <input type="hidden" name="sources" value={JSON.stringify(sources)} />
        <button className="btn" type="button" disabled={sources.length >= 5} onClick={() => setSources(old => [...old, { label: "", url: "", excerpt: "" }])}>＋参考資料（最大5件）</button>
        <p style={{ margin: "16px 0" }}>生成にはAPI利用料がかかります。サイト全体で5分枠に1回まで作成できます。画像はイラストとして生成し、カードの役や正確な数値図は作成しません。</p>
        <GenerateButton enabled={enabled} />
      </fieldset>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.id && <p role="status">{state.success} <a href={`/blog/${state.id}?preview=1`} target="_blank" rel="noreferrer">下書きをプレビュー</a> ／ <a href="/admin/blog">登録記事を編集・次の記事を作成</a></p>}
    </form>
  </section>;
}

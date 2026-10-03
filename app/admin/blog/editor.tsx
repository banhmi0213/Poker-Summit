"use client";
import { useFormState, useFormStatus } from "react-dom";
import { BLOG_CATEGORIES, type BlogEntry } from "@/lib/blog";
import { saveBlogEntry } from "./actions";

function Submit({ edit }: { edit: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn primary" disabled={pending}>{pending ? "保存中…" : edit ? "変更を保存" : "追加する"}</button>;
}
export function BlogEditor({ entry }: { entry?: BlogEntry }) {
  const [state, action] = useFormState(saveBlogEntry, {});
  return <form action={action}>
    <input type="hidden" name="id" value={entry?.id || ""} />
    <label className="field">タイトル *<input name="title" required maxLength={160} defaultValue={entry?.title} /></label>
    <label className="field">記事画像 {entry ? "（差し替えるときのみ添付）" : "*"}<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!entry} /><small>JPEG・PNG・WebP／3MB以内。文字入りの画像も切れずに表示します。</small></label>
    <label className="field">記事URL *<input name="articleUrl" type="url" required maxLength={2048} placeholder="https://..." defaultValue={entry?.article_url} /></label>
    <label className="field">カテゴリ<select name="category" defaultValue={entry?.category || BLOG_CATEGORIES[0]}>{BLOG_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="field">説明（任意）<textarea name="summary" maxLength={600} rows={3} defaultValue={entry?.summary} /></label>
    <div style={{ display:"flex", gap:20, flexWrap:"wrap", marginBottom:16 }}>
      <label><input type="checkbox" name="active" defaultChecked={entry?.active || false} /> 公開する</label>
      <label><input type="checkbox" name="featured" defaultChecked={entry?.featured || false} /> ピックアップに表示</label>
    </div>
    <Submit edit={!!entry} />
    {state.error && <p role="alert" className="err">{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
  </form>;
}

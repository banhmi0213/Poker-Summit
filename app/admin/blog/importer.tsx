"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type BlogEntry, type BlogStore } from "@/lib/blog";
import { BLOG_IMPORT_EXAMPLE, BLOG_IMPORT_MAX_LENGTH, parseBlogImport, type BlogImportResult } from "@/lib/blog-import";
import { BlogEditor } from "./editor";
import styles from "./editor.module.css";

export function BlogImport({ stores, articles }: { stores: BlogStore[]; articles: BlogEntry[] }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<BlogImportResult | null>(null);
  const [draft, setDraft] = useState<Partial<BlogEntry>>();
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const readVersion = useRef(0);
  const onSaved = useCallback(() => setSaved(true), []);
  useEffect(() => {
    if (revision) editor.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
  }, [revision]);
  function replaceRaw(value: string) {
    readVersion.current++;
    setRaw(value); setReview(null); setError("");
  }
  async function readFile(file?: File) {
    const version = ++readVersion.current;
    if (!file) return;
    setReview(null); setError("");
    if (file.size > BLOG_IMPORT_MAX_LENGTH * 4) { setError("記事データのファイルが大きすぎます。"); return; }
    try {
      const value = await file.text();
      if (version !== readVersion.current) return;
      if (value.length > BLOG_IMPORT_MAX_LENGTH) throw new Error("記事データは15万文字以内にしてください。");
      setRaw(value);
    } catch (e) {
      if (version === readVersion.current) setError(e instanceof Error ? e.message : "ファイルを読み取れませんでした。");
    }
  }
  function validate() {
    try { setReview(parseBlogImport(raw, articles)); setError(""); }
    catch (e) { setReview(null); setError(e instanceof Error ? e.message : "記事データを確認してください。"); }
  }
  function apply() {
    if (!review || saved || busy) return;
    setDraft(review.draft); setRevision(old => old + 1); setReview(null);
    setNotice(`「${review.draft.title}」を編集欄に反映しました。画像を登録して下書き保存してください。まだ保存されていません。`);
  }
  return <>
    <section className={styles.importPanel} aria-labelledby="blog-import-heading">
      <h3 id="blog-import-heading">記事データを取り込む</h3>
      <p className={styles.help}>このチャットで作成した記事データを貼り付けるか、JSONファイルを選択してください。本文・SEO設定などをまとめて入力できます。画像は手動で登録します。</p>
      <fieldset disabled={saved || busy} className={styles.importFields}>
        <label className="field">記事データ（JSON）<textarea rows={8} maxLength={BLOG_IMPORT_MAX_LENGTH} value={raw} onChange={e => replaceRaw(e.target.value)} placeholder="ここに取り込み用の記事データ全体を貼り付けてください" spellCheck={false} /></label>
        <label className="field">JSONファイルから読み込む<input type="file" accept=".json,application/json" onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <div className={styles.buttons}>
          <button type="button" className="btn primary" disabled={!raw.trim()} onClick={validate}>取り込み内容を確認</button>
          <button type="button" className="btn" onClick={() => replaceRaw(JSON.stringify(BLOG_IMPORT_EXAMPLE, null, 2))}>入力例を表示</button>
        </div>
        {review && <div className={styles.importReview}>
          <h4>取り込み内容の確認</h4>
          <dl><dt>タイトル</dt><dd>{review.draft.title}</dd><dt>カテゴリ</dt><dd>{review.draft.category}</dd><dt>記事URLスラッグ</dt><dd>{review.draft.slug}</dd><dt>SEOタイトル</dt><dd>{review.draft.seo_title || "未指定"}</dd><dt>検索結果用の説明文</dt><dd>{review.draft.meta_description || "未指定"}</dd><dt>本文</dt><dd>{review.draft.body?.length}ブロック（手動登録する本文画像：{review.draft.body?.filter(b => b.type === "image").length}枚）</dd><dt>関連記事・参考資料</dt><dd>{review.draft.related_article_ids?.length}記事・{review.draft.reference_sources?.length}件</dd></dl>
          {!!review.warnings.length && <ul>{review.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
          <p className={styles.help}>反映すると、下の新規記事欄の入力と選択中の画像を置き換えます。登録済み記事は変更しません。反映だけでは保存・公開されません。</p>
          <button type="button" className="btn primary" onClick={apply}>新規記事の編集欄に反映</button>
        </div>}
      </fieldset>
      {error && <p role="alert" className="err">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {saved && <p className={styles.help}>この記事は保存済みです。次の記事を取り込む場合は<a href="/admin/blog">新規記事画面を開いてください</a>。</p>}
    </section>
    <div ref={editor}><BlogEditor key={revision} initialDraft={draft} stores={stores} articles={articles} onSaved={onSaved} onBusyChange={setBusy} /></div>
  </>;
}

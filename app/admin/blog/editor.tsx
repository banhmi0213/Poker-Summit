"use client";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { BLOG_CATEGORIES, type BlogEntry, type BlogBlock, type BlogStore } from "@/lib/blog";
import { ArticleContent } from "@/app/blog/article-content";
import { saveBlogEntry } from "./actions";
import styles from "./editor.module.css";
function Submit() {
 const {pending} = useFormStatus();
 return <div className={styles.buttons}><button name="intent" value="draft" className="btn" disabled={pending}>{pending ? "保存中…" : "下書き保存"}</button><button name="intent" value="publish" className="btn primary" disabled={pending}>{pending ? "保存中…" : "公開して保存"}</button></div>;
}
export function BlogEditor({entry,stores,articles=[]}: {entry?:BlogEntry;stores:BlogStore[];articles?:BlogEntry[]}) {
 const [state,action] = useFormState(saveBlogEntry, {});
 const [title,setTitle] = useState(entry?.title || "");
 const [category,setCategory] = useState(entry?.category || BLOG_CATEGORIES[0]);
 const [summary,setSummary] = useState(entry?.summary || "");
 const [mode,setMode] = useState(entry?.content_mode || "internal");
 const [imageAlt,setImageAlt] = useState(entry?.image_alt || "");
 const [image,setImage] = useState(entry?.image_url || "");
 const [blocks,setBlocks] = useState<BlogBlock[]>((entry?.body?.length ? entry.body : [{type:"paragraph" as const,text:""}]).map((b,i)=>({...b,uploadKey:b.uploadKey || `saved_${i}`})));
 const [selected,setSelected] = useState<string[]>(entry?.related_store_ids || []);
 const [search,setSearch] = useState("");
 const [preview,setPreview] = useState(false);
 const [relatedArticles,setRelatedArticles] = useState<string[]>(entry?.related_article_ids || []);
 const [references,setReferences] = useState(entry?.reference_sources || []);
 const urls = useRef<string[]>([]);
 const formRef = useRef<HTMLFormElement>(null);
 const [insertAt,setInsertAt] = useState<number|null>(null);
 useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)),[]);
 useEffect(() => {if(state.body) setBlocks(state.body);if(state.imageUrl) setImage(state.imageUrl);if(state.success){formRef.current?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input=>{input.value="";});}},[state]);
 const patch = (index:number,change:Partial<BlogBlock>) => setBlocks(old => old.map((b,i) => i === index ? {...b,...change} : b));
 function photo(file?:File) { if(!file) return ""; const url=URL.createObjectURL(file);urls.current.push(url);return url; }
 function add(type:BlogBlock["type"],at=blocks.length) {setBlocks(old => {const next=[...old];next.splice(at,0,{type,text:"",uploadKey:crypto.randomUUID()});return next;});setInsertAt(null);}
 function move(index:number,delta:number) {setBlocks(old => {const next=[...old];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});}
 const related=selected.flatMap(id => stores.filter(s => s.id === id));
 return <form ref={formRef} action={action} className={styles.editor}>
 <input type="hidden" name="id" value={state.id || entry?.id || ""}/><input type="hidden" name="body" value={JSON.stringify(blocks)}/><input type="hidden" name="references" value={JSON.stringify(references)}/>{relatedArticles.map(id=><input key={id} type="hidden" name="relatedArticleIds" value={id}/>)}
 <h3 className={styles.sectionTitle}>1. 基本情報</h3>
 <label className="field">タイトル *<input name="title" required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label className="field">記事URLスラッグ *<input name="slug" required maxLength={120} defaultValue={entry?.slug || ""} placeholder="poker-hand-ranking"/><small>半角英数字とハイフン。公開後は変更しないことを推奨します。</small></label>
 <label className="field">カテゴリ<select name="category" value={category} onChange={e=>setCategory(e.target.value)}>{BLOG_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
 <label className="field">サブタイトル<textarea name="summary" rows={3} maxLength={600} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
 <label className="field">著者<input name="authorName" maxLength={120} defaultValue={entry?.author_name || ""}/></label>
 <label className="field">著者プロフィール<textarea name="authorProfile" rows={3} maxLength={1000} defaultValue={entry?.author_profile || ""}/></label>
 <label className="field">公開日時<input name="publishedAt" type="datetime-local" defaultValue={entry?.published_at ? entry.published_at.slice(0,16) : ""}/></label>
 <label className="field">メイン画像 {image ? "（差し替えるときのみ添付）" : "*"}<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!image} onChange={e=>{const url=photo(e.target.files?.[0]);if(url)setImage(url);}}/><small>記事上段と一覧に表示。JPEG・PNG・WebP／1枚・1回の添付合計3MB以内。写真が多い場合は分けて保存できます。</small></label>
 <label className="field">メイン画像のALT（代替テキスト）<input name="imageAlt" maxLength={300} value={imageAlt} onChange={e=>setImageAlt(e.target.value)} placeholder="画像の内容を説明してください"/><small>画像が表示されない場合や、読み上げで使う説明です。</small></label>
 {image && <img src={image} alt={imageAlt || "メイン画像プレビュー"} className={styles.image}/>}
 <h3 className={styles.sectionTitle}>2. SEO設定</h3>
 <label className="field">SEOタイトル<input name="seoTitle" maxLength={160} defaultValue={entry?.seo_title || ""} placeholder="空欄の場合は記事タイトルを使用"/></label>
 <label className="field">メタディスクリプション（検索結果用の説明文）<textarea name="metaDescription" rows={3} maxLength={300} defaultValue={entry?.meta_description || ""} placeholder="この記事の内容を簡潔に説明してください"/><small>検索結果向けの説明文です。空欄の場合はサブタイトルを使用します。</small></label>
 <label className="field">canonical URL<input name="canonicalUrl" type="url" maxLength={2048} defaultValue={entry?.canonical_url || ""} placeholder="通常は空欄でOK"/></label>
 <label className={styles.featured}><input type="checkbox" name="searchIndex" defaultChecked={entry?.search_index !== false}/> 検索エンジンに登録（index）</label>
 <h3 className={styles.sectionTitle}>3. 記事本文</h3>
 <label className="field">記事の形式<select name="contentMode" value={mode} onChange={e=>setMode(e.target.value as "internal"|"external")}><option value="internal">サイト内の記事</option><option value="external">外部の記事URL</option></select></label>
 {mode === "external" && <label className="field">記事URL *<input name="articleUrl" type="url" required maxLength={2048} placeholder="https://..." defaultValue={entry?.article_url || ""}/></label>}
 <div hidden={mode !== "internal"}><p className={styles.help}>文章・H2・H3・写真・箇条書き・表を追加し、上下ボタンで並べ替えできます。文章内の https:// から始まるURLはリンク表示されます。</p>
 {blocks.map((block,i)=><><section className={styles.block} key={block.uploadKey || `saved-${i}`}><div className={styles.blockHead}><strong>{block.type === "heading" ? "H2見出し" : block.type === "heading3" ? "H3見出し" : block.type === "image" ? "写真" : block.type === "list" ? "箇条書き" : block.type === "table" ? "表" : "文章"} {i+1}</strong><div><button type="button" disabled={i===0} onClick={()=>move(i,-1)} aria-label="上に移動">↑</button><button type="button" disabled={i===blocks.length-1} onClick={()=>move(i,1)} aria-label="下に移動">↓</button><button type="button" onClick={()=>setBlocks(old=>old.filter((_,n)=>n!==i))}>削除</button></div></div>
 {block.type === "list" ? <><label className="field">リスト形式<select value={block.ordered?"ordered":"unordered"} onChange={e=>patch(i,{ordered:e.target.value==="ordered"})}><option value="unordered">箇条書き</option><option value="ordered">番号付き</option></select></label><textarea rows={6} value={(block.items||[]).join("\n")} onChange={e=>patch(i,{items:e.target.value.split("\n")})} placeholder="1行に1項目"/></> : block.type === "table" ? <textarea rows={6} value={(block.rows||[]).map(r=>r.join(" | ")).join("\n")} onChange={e=>patch(i,{rows:e.target.value.split("\n").map(r=>r.split("|").map(x=>x.trim()))})} placeholder={"見出し1 | 見出し2\n内容1 | 内容2"}/> : block.type === "image" ? <><input type="file" name={`bodyImage_${block.uploadKey || i}`} accept="image/jpeg,image/png,image/webp" onChange={e=>{const url=photo(e.target.files?.[0]);if(url)patch(i,{url,uploadKey:block.uploadKey || String(i)});}}/>{block.url && <img src={block.url} alt={block.alt || "本文写真プレビュー"} className={styles.image}/>}<label className="field">写真のALT（代替テキスト）<input maxLength={300} value={block.alt || ""} onChange={e=>patch(i,{alt:e.target.value})} placeholder="写真の内容を説明してください"/></label><label className="field">写真の説明<input maxLength={300} value={block.caption || ""} onChange={e=>patch(i,{caption:e.target.value})}/></label></> : <textarea aria-label={block.type === "heading" ? "H2見出し" : block.type === "heading3" ? "H3見出し" : "文章"} rows={block.type === "heading" || block.type === "heading3" ? 2 : 6} maxLength={block.type === "heading" || block.type === "heading3" ? 200 : 20000} value={block.text || ""} onChange={e=>patch(i,{text:e.target.value})}/>}
 </section><div className={styles.insertArea}><button type="button" className="btn" disabled={blocks.length>=100} onClick={()=>setInsertAt(insertAt===i+1?null:i+1)}>＋ この位置に追加</button>{insertAt===i+1 && <div className={styles.insertMenu}>{(["paragraph","heading","heading3","image","list","table"] as const).map(type=><button key={type} type="button" className="btn" onClick={()=>add(type,i+1)}>＋{type === "paragraph" ? "文章" : type === "heading" ? "H2" : type === "heading3" ? "H3" : type === "image" ? "写真" : type === "list" ? "箇条書き" : "表"}</button>)}</div>}</div></>)}
 <div className={styles.buttons}>{(["paragraph","heading","heading3","image","list","table"] as const).map(type=><button key={type} type="button" className="btn" disabled={blocks.length>=100} onClick={()=>add(type)}>＋{type === "paragraph" ? "文章" : type === "heading" ? "H2" : type === "heading3" ? "H3" : type === "image" ? "写真" : type === "list" ? "箇条書き" : "表"}</button>)}</div></div>
 <h3 className={styles.sectionTitle}>4. 記事ナビゲーション</h3>
 <label className={styles.featured}><input type="checkbox" name="showToc" defaultChecked={entry?.show_toc !== false}/> 目次を表示</label>
 <label className={styles.featured}><input type="checkbox" name="showBreadcrumbs" defaultChecked={entry?.show_breadcrumbs !== false}/> パンくずを表示</label>
 <fieldset className={styles.related}><legend>関連記事（最大12件）</legend>{articles.filter(a=>a.id!==entry?.id).length===0&&<p className={styles.help}>選択できる別の記事はまだありません。2件目以降の記事を登録すると選択できます。</p>}{articles.filter(a=>a.id!==entry?.id).map(a=><label key={a.id} className={styles.checkRow}><input type="checkbox" checked={relatedArticles.includes(a.id)} disabled={!relatedArticles.includes(a.id)&&relatedArticles.length>=12} onChange={e=>setRelatedArticles(old=>e.target.checked?[...old,a.id]:old.filter(id=>id!==a.id))}/>{a.title}</label>)}</fieldset>
 <h3 className={styles.sectionTitle}>5. 関連情報</h3>
 <fieldset className={styles.related}><legend>関連店舗（複数選択可）</legend><input type="search" placeholder="店舗名・都道府県で絞り込み" aria-label="関連店舗を検索" value={search} onChange={e=>setSearch(e.target.value)}/><p className={styles.help}>選択した店舗への「店舗詳細を見る」リンクが記事に表示されます（最大20店舗）。</p><div className={styles.storeList}>{stores.filter(s=>`${s.name} ${s.pref || ""}`.toLowerCase().includes(search.toLowerCase())).map(store=><label key={store.id}><input type="checkbox" value={store.id} checked={selected.includes(store.id)} disabled={!selected.includes(store.id)&&selected.length>=20} onChange={e=>setSelected(old=>e.target.checked ? [...old,store.id] : old.filter(id=>id!==store.id))}/>{store.name} <small>{store.pref}</small></label>)}</div>{selected.map(id=><input key={id} type="hidden" name="storeIds" value={id}/>)}</fieldset>
 <h3 className={styles.sectionTitle}>6. 出典・権利管理</h3>
 <label className="field">画像の権利情報<textarea name="imageRights" rows={3} maxLength={1000} defaultValue={entry?.image_rights || ""} placeholder="自社制作／AI生成／提供元／引用条件など"/></label>
 <fieldset className={styles.related}><legend>参考資料</legend>{references.map((r,i)=><div key={i} className={styles.referenceRow}><input value={r.label} onChange={e=>setReferences(old=>old.map((x,n)=>n===i?{...x,label:e.target.value}:x))} placeholder="資料名"/><input type="url" value={r.url||""} onChange={e=>setReferences(old=>old.map((x,n)=>n===i?{...x,url:e.target.value}:x))} placeholder="https://..."/><button type="button" onClick={()=>setReferences(old=>old.filter((_,n)=>n!==i))}>削除</button></div>)}<button type="button" className="btn" onClick={()=>setReferences(old=>[...old,{label:"",url:""}])}>＋参考資料</button></fieldset>
 <h3 className={styles.sectionTitle}>7. 公開設定</h3>
 <label className="field">公開状態<select name="visibility" defaultValue={entry?.visibility || (entry?.active ? "published" : "draft")}><option value="draft">下書き（管理画面のみ）</option><option value="published">公開</option><option value="private">非公開（管理画面のみ）</option></select></label>
 <label className={styles.featured}><input type="checkbox" name="includeInSitemap" defaultChecked={entry?.include_in_sitemap !== false}/> サイトマップに掲載</label>
 <label className={styles.featured}><input type="checkbox" name="featured" defaultChecked={entry?.featured || false}/> ピックアップに表示</label>
 <div className={styles.buttons}><button type="button" className="btn" onClick={()=>setPreview(!preview)}>{preview ? "プレビューを閉じる" : "保存前にプレビュー"}</button>{(state.id || entry?.id) && <Link className="btn" href={`/blog/${state.id || entry?.id}?preview=1`} target="_blank">保存済みの記事を見る ↗</Link>}</div>
 {preview && <div className={styles.preview}><h3>保存前プレビュー</h3><ArticleContent title={title} category={category} summary={summary} image={image} imageAlt={imageAlt} body={mode === "internal" ? blocks : []} stores={related} references={references}/>{mode === "external" && <p>記事を読むと、入力した外部URLへ移動します。</p>}</div>}
 <p className={styles.help}>下書き・非公開の記事は一般公開されません。公開する場合だけ「公開して保存」を使用してください。</p><Submit/>{state.error && <p role="alert" className="err">{state.error}</p>}{state.success && <p role="status">{state.success} {!entry && <a href="/admin/blog">続けて新しい記事を作成 →</a>}</p>}
 </form>;
}

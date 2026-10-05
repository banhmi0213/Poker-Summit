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
export function BlogEditor({entry,stores}: {entry?:BlogEntry;stores:BlogStore[]}) {
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
 const urls = useRef<string[]>([]);
 useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)),[]);
 useEffect(() => {if(state.body) setBlocks(state.body);if(state.imageUrl) setImage(state.imageUrl);},[state]);
 const patch = (index:number,change:Partial<BlogBlock>) => setBlocks(old => old.map((b,i) => i === index ? {...b,...change} : b));
 function photo(file?:File) { if(!file) return ""; const url=URL.createObjectURL(file);urls.current.push(url);return url; }
 function add(type:BlogBlock["type"]) {setBlocks(old => [...old,{type,text:"",uploadKey:crypto.randomUUID()}]);}
 function move(index:number,delta:number) {setBlocks(old => {const next=[...old];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});}
 const related=selected.flatMap(id => stores.filter(s => s.id === id));
 return <form action={action} className={styles.editor}>
 <input type="hidden" name="id" value={state.id || entry?.id || ""}/><input type="hidden" name="body" value={JSON.stringify(blocks)}/>
 <label className="field">メイン画像 {image ? "（差し替えるときのみ添付）" : "*"}<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!image} onChange={e=>{const url=photo(e.target.files?.[0]);if(url)setImage(url);}}/><small>記事上段と一覧に表示。JPEG・PNG・WebP／1枚・1回の添付合計3MB以内。写真が多い場合は分けて保存できます。</small></label>
 <label className="field">メイン画像のALT（代替テキスト）<input name="imageAlt" maxLength={300} value={imageAlt} onChange={e=>setImageAlt(e.target.value)} placeholder="画像の内容を説明してください"/><small>画像が表示されない場合や、読み上げで使う説明です。</small></label>
 {image && <img src={image} alt={imageAlt || "メイン画像プレビュー"} className={styles.image}/>}
 <label className="field">タイトル *<input name="title" required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label className="field">カテゴリ<select name="category" value={category} onChange={e=>setCategory(e.target.value)}>{BLOG_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
 <label className="field">サブタイトル<textarea name="summary" rows={3} maxLength={600} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
 <label className="field">メタディスクリプション（検索結果用の説明文）<textarea name="metaDescription" rows={3} maxLength={300} defaultValue={entry?.meta_description || ""} placeholder="この記事の内容を簡潔に説明してください"/><small>検索結果向けの説明文です。空欄の場合はサブタイトルを使用します。</small></label>
 <label className="field">記事の形式<select name="contentMode" value={mode} onChange={e=>setMode(e.target.value as "internal"|"external")}><option value="internal">サイト内の記事</option><option value="external">外部の記事URL</option></select></label>
 {mode === "external" && <label className="field">記事URL *<input name="articleUrl" type="url" required maxLength={2048} placeholder="https://..." defaultValue={entry?.article_url || ""}/></label>}
 <div hidden={mode !== "internal"}><h3>記事本文</h3><p className={styles.help}>文章・見出し・写真を追加し、上下ボタンで並べ替えできます。</p>
 {blocks.map((block,i)=><section className={styles.block} key={block.uploadKey || `saved-${i}`}><div className={styles.blockHead}><strong>{block.type === "heading" ? "見出し" : block.type === "image" ? "写真" : "文章"} {i+1}</strong><div><button type="button" disabled={i===0} onClick={()=>move(i,-1)} aria-label="上に移動">↑</button><button type="button" disabled={i===blocks.length-1} onClick={()=>move(i,1)} aria-label="下に移動">↓</button><button type="button" onClick={()=>setBlocks(old=>old.filter((_,n)=>n!==i))}>削除</button></div></div>
 {block.type === "image" ? <><input type="file" name={`bodyImage_${block.uploadKey || i}`} accept="image/jpeg,image/png,image/webp" onChange={e=>{const url=photo(e.target.files?.[0]);if(url)patch(i,{url,uploadKey:block.uploadKey || String(i)});}}/>{block.url && <img src={block.url} alt={block.alt || "本文写真プレビュー"} className={styles.image}/>}<label className="field">写真のALT（代替テキスト）<input maxLength={300} value={block.alt || ""} onChange={e=>patch(i,{alt:e.target.value})} placeholder="写真の内容を説明してください"/></label><label className="field">写真の説明<input maxLength={300} value={block.caption || ""} onChange={e=>patch(i,{caption:e.target.value})}/></label></> : <textarea aria-label={block.type === "heading" ? "見出し" : "文章"} rows={block.type === "heading" ? 2 : 6} maxLength={block.type === "heading" ? 200 : 20000} value={block.text || ""} onChange={e=>patch(i,{text:e.target.value})}/>}
 </section>)}
 <div className={styles.buttons}>{(["paragraph","heading","image"] as const).map(type=><button key={type} type="button" className="btn" disabled={blocks.length>=100} onClick={()=>add(type)}>＋{type === "paragraph" ? "文章" : type === "heading" ? "見出し" : "写真"}</button>)}</div></div>
 <fieldset className={styles.related}><legend>関連店舗（複数選択可）</legend><input type="search" placeholder="店舗名・都道府県で絞り込み" aria-label="関連店舗を検索" value={search} onChange={e=>setSearch(e.target.value)}/><p className={styles.help}>選択した店舗への「店舗詳細を見る」リンクが記事に表示されます（最大20店舗）。</p><div className={styles.storeList}>{stores.filter(s=>`${s.name} ${s.pref || ""}`.toLowerCase().includes(search.toLowerCase())).map(store=><label key={store.id}><input type="checkbox" value={store.id} checked={selected.includes(store.id)} disabled={!selected.includes(store.id)&&selected.length>=20} onChange={e=>setSelected(old=>e.target.checked ? [...old,store.id] : old.filter(id=>id!==store.id))}/>{store.name} <small>{store.pref}</small></label>)}</div>{selected.map(id=><input key={id} type="hidden" name="storeIds" value={id}/>)}</fieldset>
 <label className={styles.featured}><input type="checkbox" name="featured" defaultChecked={entry?.featured || false}/> ピックアップに表示</label>
 <div className={styles.buttons}><button type="button" className="btn" onClick={()=>setPreview(!preview)}>{preview ? "プレビューを閉じる" : "保存前にプレビュー"}</button>{(state.id || entry?.id) && <Link className="btn" href={`/blog/${state.id || entry?.id}?preview=1`} target="_blank">保存済みの記事を見る ↗</Link>}</div>
 {preview && <div className={styles.preview}><h3>保存前プレビュー</h3><ArticleContent title={title} category={category} summary={summary} image={image} imageAlt={imageAlt} body={mode === "internal" ? blocks : []} stores={related}/>{mode === "external" && <p>記事を読むと、入力した外部URLへ移動します。</p>}</div>}
 <Submit/>{state.error && <p role="alert" className="err">{state.error}</p>}{state.success && <p role="status">{state.success} {!entry && <a href="/admin/blog">続けて新しい記事を作成 →</a>}</p>}
 </form>;
}

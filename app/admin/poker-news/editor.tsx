"use client";
import { useEffect,useRef,useState } from "react";
import { useFormState,useFormStatus } from "react-dom";
import { savePokerNews,importPokerNews,previewPokerNewsImage } from "./actions";
import styles from "./editor.module.css";
const categories=["国内大会","海外大会","大会結果","業界情報","配信・アプリ","未確認・参考"];
function Submit({children}:{children:React.ReactNode}){const {pending}=useFormStatus();return <button className="btn primary" disabled={pending}>{pending?"保存中…":children}</button>;}
export function NewsEditor({entry,blogs,today}:{entry?:Record<string,any>;blogs:{id:string;title:string;active:boolean}[];today:string}){
 const [state,action]=useFormState(savePokerNews,{});
 const [source,setSource]=useState(entry?.source_url||"");
 const [mode,setMode]=useState(entry?.thumbnail_mode||"auto");
 const [image,setImage]=useState(entry?.thumbnail_url||"");
 const [imageSource,setImageSource]=useState(entry?.thumbnail_source_url||"");
 const [message,setMessage]=useState(entry?.thumbnail_error||"");
 const [loading,setLoading]=useState(false);const [refresh,setRefresh]=useState(false);const requestToken=useRef(0);
 useEffect(()=>{if(state.imageUrl!==undefined)setImage(state.imageUrl);if(state.imageSourceUrl!==undefined)setImageSource(state.imageSourceUrl);},[state.imageUrl,state.imageSourceUrl]);
 async function preview(){if(mode!=="auto"||!source)return;const token=++requestToken.current;setLoading(true);setMessage("紹介画像を取得しています…");try{const result=await previewPokerNewsImage(source);if(requestToken.current!==token)return;setImage(result.imageUrl);setImageSource(result.sourceUrl);setRefresh(true);setMessage(result.error||"紹介画像を取得しました。保存するとニュースに反映されます。");}catch{if(requestToken.current===token)setMessage("画像を取得できませんでした。保存後の再取得や手動登録も可能です。");}finally{if(requestToken.current===token)setLoading(false);}}
 return <form action={action} className={styles.form}>
  <h2>{entry?"ニュースを編集":"ニュースを新規登録"}</h2>
  <input type="hidden" name="id" value={entry?.id||""}/><input type="hidden" name="import_key" value={entry?.import_key||""}/><input type="hidden" name="thumbnail_refresh" value={refresh?"on":""}/>
  <label>見出し（必須・200文字以内）<input name="title" required maxLength={200} defaultValue={entry?.title||""}/></label>
  <label>概要（必須・600文字以内）<textarea name="summary" required maxLength={600} rows={3} defaultValue={entry?.summary||""}/></label>
  <div className={styles.pair}><label>カテゴリ<select name="category" defaultValue={entry?.category||categories[0]}>{categories.map(x=><option key={x}>{x}</option>)}</select></label><label>掲載日・収集日<input type="date" name="news_date" required defaultValue={entry?.news_date||today}/></label></div>
  <label>参照サイトURL（必須）<input name="source_url" type="url" required maxLength={2048} value={source} onChange={e=>{requestToken.current++;setLoading(false);setSource(e.target.value);}} onBlur={()=>{if(source!==entry?.source_url)void preview();}} placeholder="https://"/></label>
  <label>参照リンクの表示名<input name="source_label" maxLength={60} defaultValue={entry?.source_label||"情報元を見る"}/></label>
  <fieldset className={styles.imageSettings}><legend>ニュースの紹介画像</legend>
   <label>画像の表示方法<select name="thumbnail_mode" value={mode} onChange={e=>{requestToken.current++;setLoading(false);setMode(e.target.value);}}><option value="auto">参照URLから自動取得</option><option value="manual">手動画像を使う</option><option value="none">画像を表示しない</option></select></label>
   <p>自動取得では、リンク先のSNS向け紹介画像（OGP）を使用します。取得できない場合も、ニュースは画像なしで保存できます。</p>
   {mode==="auto"&&<button className="btn" type="button" disabled={loading||!source} onClick={()=>void preview()}>{loading?"取得中…":"URLから画像を再取得"}</button>}
   {mode==="manual"&&<><label>画像ファイル（JPEG・PNG・WebP／3MB以内）<input type="file" name="thumbnail_file" accept="image/jpeg,image/png,image/webp"/></label><label>または画像URL（HTTPS）<input type="url" name="thumbnail_url" value={image} onChange={e=>setImage(e.target.value)} maxLength={2048} placeholder="https://"/></label></>}
   {mode!=="manual"&&<input type="hidden" name="thumbnail_url" value={image}/>}
   {mode!=="none"&&image&&<div className={styles.preview}><img key={image} src={image} alt="紹介画像のプレビュー" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/><span>紹介画像プレビュー</span></div>}
   <p role="status">{message}</p>
   <label>画像の説明（ALT／300文字以内）<input name="thumbnail_alt" maxLength={300} defaultValue={entry?.thumbnail_alt||""}/></label>
   <label>画像の出典ページURL<input name="thumbnail_source_url" type="url" maxLength={2048} value={imageSource} onChange={e=>setImageSource(e.target.value)} placeholder="https://"/></label>
   <label>出典・利用許諾のメモ<textarea name="thumbnail_rights" maxLength={1000} rows={2} defaultValue={entry?.thumbnail_rights||""}/></label><p>画像の利用条件は情報元でご確認ください。</p>
  </fieldset>
  <label>関連記事（未選択ならリンクを表示しません）<select name="related_blog_id" defaultValue={entry?.related_blog_id||""}><option value="">関連記事なし</option>{blogs.map(x=><option key={x.id} value={x.id}>{!x.active?"【非公開】":""}{x.title}</option>)}</select></label><p>関連記事が下書き・非公開になった場合も、公開画面のリンクは非表示になります。</p>
  <label className={styles.checkbox}><input type="checkbox" name="active" defaultChecked={entry?.active===true}/> 公開する（OFFで下書き・非公開）</label><Submit>保存する</Submit>{state.error&&<p className="err" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
 </form>;
}
export function NewsImporter(){const [state,action]=useFormState(importPokerNews,{});return <details className={styles.importer}><summary>ChatGPTのニュースデータを一括取り込み</summary><p>JSON配列を貼り付けると最大100件を一括登録できます。同じimport_keyは更新され、重複しません。activeを省略すると下書きです。紹介画像は自動取得されます。</p><form action={action} className={styles.form}><label>JSONデータ<textarea name="json" required rows={8} maxLength={500000} placeholder={'[{"import_key":"news-20261024-01","title":"見出し","summary":"概要","category":"国内大会","source_url":"https://example.com/","source_label":"公式情報を見る","news_date":"2026-10-24","related_blog_id":null,"active":false,"thumbnail_mode":"auto"}]'}/></label><Submit>取り込む</Submit>{state.error&&<p className="err" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</form></details>;}

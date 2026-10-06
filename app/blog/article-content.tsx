import Link from "next/link";
import { blogHeadingId, type BlogBlock, type BlogEntry, type BlogStore } from "@/lib/blog";
import { StoreNamePlaceholder } from "@/app/store-name-placeholder";
import styles from "./article.module.css";

function Paragraph({text=""}:{text?:string}) {
 const parts=text.split(/(https?:\/\/[^\s]+)/g);
 return <p>{parts.map((part,i)=>/^https?:\/\//.test(part)?<a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>:part)}</p>;
}
export function ArticleContent({ title, category, summary, image, imageAlt, body, stores, authorName="", authorProfile="", publishedAt, updatedAt, showToc=true, references=[] }: {
 title:string; category:string; summary:string; image:string; imageAlt?:string; body:BlogBlock[]; stores:BlogStore[];
 authorName?:string; authorProfile?:string; publishedAt?:string|null; updatedAt?:string; showToc?:boolean; references?:BlogEntry["references"];
}) {
 const headings=body.map((b,i)=>({b,i})).filter(({b})=>b.type==="heading"||b.type==="heading3");
 const date=(v?:string|null)=>v?new Date(v).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"}):"";
 return <article className={styles.article}>
  {image && <div className={styles.cover}><img src={image} alt={imageAlt || title} /></div>}
  <header><span className={styles.category}>{category}</span><h1>{title || "記事タイトル"}</h1>{summary && <p className={styles.summary}>{summary}</p>}
   {(authorName||publishedAt) && <div className={styles.byline}>{authorName&&<span>著者：{authorName}</span>}{publishedAt&&<time>公開日：{date(publishedAt)}</time>}{updatedAt&&publishedAt&&date(updatedAt)!==date(publishedAt)&&<time>更新日：{date(updatedAt)}</time>}</div>}
   {authorProfile&&<p className={styles.authorProfile}>{authorProfile}</p>}
  </header>
  {showToc&&headings.length>0&&<nav className={styles.toc} aria-label="目次"><strong>目次</strong><ol>{headings.map(({b,i})=><li key={i} className={b.type==="heading3"?styles.tocSub:undefined}><a href={`#${blogHeadingId(b.text||"",i)}`}>{b.text}</a></li>)}</ol></nav>}
  <div className={styles.body}>{body.map((block,i)=>{
   const id=blogHeadingId(block.text||"",i);
   if(block.type==="heading")return <h2 id={id} key={i}>{block.text}</h2>;
   if(block.type==="heading3")return <h3 id={id} key={i}>{block.text}</h3>;
   if(block.type==="image")return block.url?<figure key={i}><img src={block.url} alt={block.alt||block.caption||"記事写真"}/>{block.caption&&<figcaption>{block.caption}</figcaption>}</figure>:null;
   if(block.type==="list")return block.ordered?<ol key={i}>{(block.items||[]).map((x,n)=><li key={n}>{x}</li>)}</ol>:<ul key={i}>{(block.items||[]).map((x,n)=><li key={n}>{x}</li>)}</ul>;
   if(block.type==="table")return <div className={styles.tableWrap} key={i}><table><tbody>{(block.rows||[]).map((row,r)=><tr key={r}>{row.map((cell,n)=>r===0?<th key={n}>{cell}</th>:<td key={n}>{cell}</td>)}</tr>)}</tbody></table></div>;
   return <Paragraph key={i} text={block.text}/>;
  })}</div>
  {!!references?.length&&<section className={styles.references}><h2>参考資料</h2><ul>{references.map((r,i)=><li key={i}>{r.url?<a href={r.url} target="_blank" rel="noopener noreferrer">{r.label||r.url}</a>:r.label}</li>)}</ul></section>}
  {!!stores.length&&<section className={styles.related}><h2>この記事で紹介した店舗</h2><div>{stores.map(store=><Link key={store.id} href={`/stores/${store.id}`} className={styles.store}>{store.banner_url?<img src={store.banner_url} alt={store.name}/>:<StoreNamePlaceholder name={store.name}/>}<h3>{store.name}</h3><p>{[store.pref,store.city].filter(Boolean).join(" ")}</p><strong>店舗詳細を見る →</strong></Link>)}</div></section>}
 </article>;
}

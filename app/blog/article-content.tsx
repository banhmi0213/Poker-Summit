import Link from "next/link";
import type { BlogBlock, BlogStore } from "@/lib/blog";
import { StoreNamePlaceholder } from "@/app/store-name-placeholder";
import styles from "./article.module.css";
export function ArticleContent({ title, category, summary, image, body, stores }: { title:string; category:string; summary:string; image:string; body:BlogBlock[]; stores:BlogStore[] }) {
 return <article className={styles.article}>
  {image && <div className={styles.cover}><img src={image} alt={title} /></div>}
  <header><span className={styles.category}>{category}</span><h1>{title || "記事タイトル"}</h1>{summary && <p className={styles.summary}>{summary}</p>}</header>
  <div className={styles.body}>{body.map((block,i) => block.type === "heading" ? <h2 key={i}>{block.text}</h2> : block.type === "image" ? block.url && <figure key={i}><img src={block.url} alt={block.caption || "記事写真"} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure> : <p key={i}>{block.text}</p>)}</div>
  {!!stores.length && <section className={styles.related}><h2>この記事で紹介した店舗</h2><div>{stores.map(store => <Link key={store.id} href={`/stores/${store.id}`} className={styles.store}>{store.banner_url ? <img src={store.banner_url} alt={store.name} /> : <StoreNamePlaceholder name={store.name} />}<h3>{store.name}</h3><p>{[store.pref,store.city].filter(Boolean).join(" ")}</p><strong>店舗詳細を見る →</strong></Link>)}</div></section>}
 </article>;
}

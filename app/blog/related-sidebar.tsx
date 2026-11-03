"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { BlogEntry } from "@/lib/blog";
import styles from "./article.module.css";

export type RelatedArticleCard=Pick<BlogEntry,"id"|"slug"|"title"|"category"|"image_url"|"image_alt"|"active">;

export function RelatedSidebar({articles,relatedPost}:{articles:RelatedArticleCard[];relatedPost?:ReactNode}){
 const sidebar=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const header=document.querySelector<HTMLElement>('[aria-label="メインナビゲーション"]');
  if(!header) return;
  const update=()=>sidebar.current?.style.setProperty("--blog-header-height",`${Math.ceil(header.getBoundingClientRect().height)}px`);
  update();
  const observer=new ResizeObserver(update);
  observer.observe(header);
  return ()=>observer.disconnect();
 },[]);
 const fallback="/images/navigation/blog-v1.webp";
 return <aside className={styles.sidebar} aria-labelledby="blog-related-heading">
  <div ref={sidebar} className={styles.sidebarSticky} style={{"--blog-header-height":"152px"} as CSSProperties} tabIndex={0}>
   <p className={styles.sidebarEyebrow}>READ NEXT</p>
   <h2 id="blog-related-heading">あわせて読みたい</h2>
   <p className={styles.sidebarLead}>関連記事・おすすめ記事</p>
   {articles.length>0?<ul className={styles.sidebarList}>{articles.map(article=><li key={article.id}>
    <Link href={`/blog/${article.slug||article.id}`} className={styles.sidebarCard}>
     <img src={article.image_url||fallback} alt="" width={112} height={72} loading="lazy" decoding="async"
      onError={event=>{if(!event.currentTarget.src.endsWith(fallback))event.currentTarget.src=fallback;}}/>
     <span><small>{article.category}</small><strong>{article.title}</strong></span>
    </Link>
   </li>)}</ul>:<p className={styles.sidebarEmpty}>ポーカーのルールや戦略、最新の話題をチェック。</p>}
   <Link href="/blog" className={styles.sidebarAll}>ブログ一覧を見る <span aria-hidden="true">→</span></Link>
   <Link href="/learn" className={styles.sidebarLearn}>無料の学習コースへ <span aria-hidden="true">→</span></Link>
   {relatedPost && <section className={styles.sidebarPost}><h3>関連するX投稿</h3>{relatedPost}</section>}
  </div>
 </aside>;
}

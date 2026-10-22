"use client";

import { useRef } from "react";
import { normalizeXPostUrl } from "@/lib/x-post";
import Script from "next/script";
import styles from "./tournament-post.module.css";

export function TournamentPost({url}: {url:string}) {
 let postUrl="";
 try { postUrl=normalizeXPostUrl(url); } catch { /* Invalid legacy values stay hidden. */ }
 const container = useRef<HTMLDivElement>(null);
 function loadPost() {
  const twitter = (window as Window & { twttr?: { widgets?: { load: (element: HTMLElement) => void } } }).twttr;
  if (container.current) twitter?.widgets?.load(container.current);
 }
 if (!postUrl) return null;
 return <aside className={styles.sidebar} aria-label="関連するX投稿">
  <h2>関連するX投稿</h2>
  <div key={postUrl} ref={container}>
   <blockquote className="twitter-tweet" data-lang="ja" data-dnt="true">
    <a href={postUrl} target="_blank" rel="noopener noreferrer">投稿をXで見る</a>
   </blockquote>
  </div>
  <p className={styles.fallback}><a href={postUrl} target="_blank" rel="noopener noreferrer">投稿が表示されない場合はXで見る</a></p>
  <Script id="blog-x-widgets" src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" onReady={loadPost} />
 </aside>;
}

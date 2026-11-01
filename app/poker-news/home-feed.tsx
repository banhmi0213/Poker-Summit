"use client";
import { useState } from "react";
import Link from "next/link";
import type { PokerNews } from "@/lib/poker-news";
import { PokerNewsList } from "./news-list";
import styles from "../home-poker-news.module.css";
export function HomeNewsFeed({entries,count}:{entries:PokerNews[];count:number}){
 const [expanded,setExpanded]=useState(false);
 return <><div id="home-news-items"><PokerNewsList entries={expanded?entries:entries.slice(0,4)}/></div><footer className={styles.footer}><p aria-live="polite">全{count}件中 {Math.min(expanded?10:4,entries.length)}件を表示</p>{!expanded&&entries.length>4?<button type="button" aria-expanded={expanded} aria-controls="home-news-items" onClick={()=>setExpanded(true)}>更に表示する</button>:<Link href="/poker-news">全て見る</Link>}</footer></>;
}

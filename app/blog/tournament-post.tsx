"use client";

import { useEffect, useRef } from "react";
import { normalizeXPostUrl } from "@/lib/x-post";
import styles from "./tournament-post.module.css";

type XWidgets = { createTweet: (id:string, element:HTMLElement, options:{lang:string;dnt:boolean}) => Promise<HTMLElement | undefined> };
let widgetsPromise: Promise<XWidgets> | undefined;
function loadWidgets() {
 const current=()=>(window as Window & {twttr?:{widgets?:XWidgets}}).twttr?.widgets;
 if(current()) return Promise.resolve(current()!);
 if(!widgetsPromise) widgetsPromise=new Promise<XWidgets>((resolve,reject)=>{
  let script=document.querySelector<HTMLScriptElement>('script[src="https://platform.twitter.com/widgets.js"]');
  const ready=()=>{const widgets=current();widgets?resolve(widgets):reject(new Error("X unavailable"));};
  if(!script){script=document.createElement("script");script.src="https://platform.twitter.com/widgets.js";script.async=true;document.head.appendChild(script);}
  script.addEventListener("load",ready,{once:true});
  script.addEventListener("error",()=>reject(new Error("X unavailable")),{once:true});
 }).catch(error=>{widgetsPromise=undefined;throw error;});
 return widgetsPromise;
}

export function TournamentPost({url,inline=false}: {url:string;inline?:boolean}) {
 let postUrl="";
 try { postUrl=normalizeXPostUrl(url); } catch { /* Invalid legacy values stay hidden. */ }
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!postUrl || !container.current)return;
  // Separate target prevents an earlier async render from modifying a newer post.
  const target=document.createElement("div");container.current.replaceChildren(target);
  let disposed=false;
  loadWidgets().then(widgets=>{if(!disposed)return widgets.createTweet(postUrl.split("/").pop()!,target,{lang:"ja",dnt:true});}).catch(()=>{});
  return ()=>{disposed=true;target.remove();};
 },[postUrl]);
 if(!postUrl)return null;
 return <aside className={inline?styles.inline:styles.sidebar} aria-label="関連するX投稿">
  {!inline&&<h2>関連するX投稿</h2>}
  <div ref={container}/>
  <p className={styles.fallback}><a href={postUrl} target="_blank" rel="noopener noreferrer">投稿をXで見る</a></p>
 </aside>;
}

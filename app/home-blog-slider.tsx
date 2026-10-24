"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { blogArticleHref } from "@/lib/blog";
import type { HomeBlogEntry } from "@/lib/home-blog";
import styles from "./home-blog-slider.module.css";

export function HomeBlogSlider({entries}:{entries:HomeBlogEntry[]}) {
 const rail=useRef<HTMLUListElement>(null);
 const drag=useRef({active:false,moved:false,x:0,left:0});
 const [dragging,setDragging]=useState(false);
 const [edges,setEdges]=useState({start:true,end:true});
 function updateEdges(){const el=rail.current;if(el)setEdges({start:el.scrollLeft<=2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2});}
 useEffect(()=>{
  const el=rail.current;if(!el)return;
  updateEdges();
  const observer=new ResizeObserver(updateEdges);observer.observe(el);
  return ()=>observer.disconnect();
 },[entries.length]);
 function scroll(direction:number){const el=rail.current;if(el)el.scrollBy({left:direction*el.clientWidth*.85,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}
 function finish(){drag.current.active=false;setDragging(false);setTimeout(()=>{drag.current.moved=false;},0);}
 if(!entries.length)return null;
 return <section className={styles.section} aria-labelledby="home-blog-heading">
  <div className={styles.heading}><div><span>POKER SUMMIT BLOG</span><h2 id="home-blog-heading"><span aria-hidden="true">📝</span> 新着ブログ</h2></div><Link href="/blog?sort=newest">ブログ一覧を見る</Link></div>
  <div className={styles.controls}><p id="home-blog-help">横にドラッグ・スワイプして過去の記事もチェック</p><div><button type="button" aria-label="新しい記事の方向へ" aria-controls="home-blog-rail" disabled={edges.start} onClick={()=>scroll(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><button type="button" aria-label="過去の記事の方向へ" aria-controls="home-blog-rail" disabled={edges.end} onClick={()=>scroll(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button></div></div>
  <ul id="home-blog-rail" ref={rail} tabIndex={0} aria-label="ブログ記事、新着順" aria-describedby="home-blog-help" className={`${styles.rail} ${dragging?styles.dragging:""}`} onScroll={updateEdges}
   onDragStart={e=>e.preventDefault()}
   onPointerDown={e=>{if(e.pointerType!=="mouse"||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;drag.current={active:true,moved:false,x:e.clientX,left:e.currentTarget.scrollLeft};}}
   onPointerMove={e=>{const d=drag.current;if(!d.active)return;const delta=e.clientX-d.x;if(!d.moved&&Math.abs(delta)<6)return;if(!d.moved){d.moved=true;setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);}e.preventDefault();e.currentTarget.scrollLeft=d.left-delta;}}
   onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onPointerLeave={()=>{if(!drag.current.moved)drag.current.active=false;}}
   onClickCapture={e=>{if(drag.current.moved){e.preventDefault();e.stopPropagation();}}}
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();scroll(e.key==="ArrowLeft"?-1:1);}}}>
   {entries.map(entry=><li key={entry.id} className={styles.item}><Link href={blogArticleHref(entry)} className={styles.card}>
    <div className={styles.photo}>{entry.image_url?<img src={entry.image_url} alt={entry.image_alt||""} loading="lazy" decoding="async" draggable={false} width={480} height={270}/>:<span>POKER SUMMIT BLOG</span>}</div>
    <div className={styles.copy}><span className={styles.category}>{entry.category}</span><h3>{entry.title}</h3><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}</time></div>
   </Link></li>)}
  </ul>
 </section>;
}

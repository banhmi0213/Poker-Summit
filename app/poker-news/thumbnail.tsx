"use client";
import { useState } from "react";
import styles from "../home-poker-news.module.css";
export function NewsThumbnail({url,alt,source}:{url:string;alt:string;source:string}){const [failed,setFailed]=useState(false);if(failed)return null;return <a href={source} target="_blank" rel="noopener noreferrer" className={styles.newsThumbnail} aria-label="紹介画像の情報元を見る"><img src={url} alt={alt} width={256} height={160} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></a>;}

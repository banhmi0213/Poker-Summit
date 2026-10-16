"use client";
import { useState, type ReactNode } from "react";
import styles from "./poker-table.module.css";

export default function GameNavigation({header,footer}:{header:ReactNode;footer:ReactNode}) {
  const [panel,setPanel]=useState<"header"|"footer"|null>(null);
  return <>
    <div className={styles.mobileSiteBar}><a href="/">Poker Summit</a><button type="button" aria-expanded={panel==="header"} aria-controls="game-site-header" onClick={()=>setPanel(panel==="header"?null:"header")}>{panel==="header"?"閉じる ×":"サイトメニュー ☰"}</button></div>
    <div id="game-site-header" className={styles.gameHeader} data-open={panel==="header"}>{header}</div>
    <button type="button" className={styles.mobileFooterToggle} aria-expanded={panel==="footer"} aria-controls="game-site-footer" onClick={()=>setPanel(panel==="footer"?null:"footer")}>{panel==="footer"?"閉じる ×":"サイト情報 ▴"}</button>
    <div id="game-site-footer" className={styles.gameFooter} data-open={panel==="footer"}>{footer}</div>
  </>;
}

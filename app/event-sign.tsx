import type { CSSProperties } from "react";
import { eventSignDate, eventSignLabel, eventTitleLines, eventTitleWidth } from "@/lib/event-sign";
import styles from "./event-sign.module.css";
export function EventSign({title,category,startAt,venue,hero=false,compact=false,dateOnly=false}:{title:string;category?:string|null;startAt?:string|null;venue?:string|null;hero?:boolean;compact?:boolean;dateOnly?:boolean}) {
 const lines=eventTitleLines(title);
 const width=Math.max(...lines.map(eventTitleWidth),1);
 const titleStyle:CSSProperties={fontSize:`min(${hero?48:compact?14:25}px, ${90/width}cqi)`};
 return <div data-event-sign className={`${styles.sign} ${hero?styles.hero:""} ${compact?styles.compact:""}`}>
  <span className={styles.kind}>{eventSignLabel(category)}</span>
  <span className={styles.title} style={titleStyle}>{lines.map((line,i)=><span key={i}>{line}</span>)}</span>
  {!compact && <span className={styles.meta}>{dateOnly && startAt ? new Date(startAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit" }) : eventSignDate(startAt)}{venue && <> ｜ {venue}</>}</span>}
 </div>;
}

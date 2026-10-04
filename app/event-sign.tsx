import type { CSSProperties } from "react";
import { eventSignDate, eventSignLabel, eventTitleLines, eventTitleWidth } from "@/lib/event-sign";
import styles from "./event-sign.module.css";
export function EventSign({title,category,startAt,venue,hero=false,compact=false}:{title:string;category?:string|null;startAt?:string|null;venue?:string|null;hero?:boolean;compact?:boolean}) {
 const lines=eventTitleLines(title);
 const width=Math.max(...lines.map(eventTitleWidth),1);
 const titleStyle:CSSProperties={fontSize:`min(${hero?48:compact?14:25}px, ${90/width}cqi)`};
 return <div data-event-sign className={`${styles.sign} ${hero?styles.hero:""} ${compact?styles.compact:""}`}>
  <span className={styles.kind}>{eventSignLabel(category)}</span>
  <span className={styles.title} style={titleStyle}>{lines.map((line,i)=><span key={i}>{line}</span>)}</span>
  {!compact && <span className={styles.meta}>{eventSignDate(startAt)}{venue && <> ｜ {venue}</>}</span>}
 </div>;
}

"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import styles from "./dealer.module.css";
export function WorkDates({ initialDates, today }: { initialDates: string[]; today: string }) {
 const [dates,setDates]=useState(()=>[...new Set(initialDates)].sort());
 const [month,setMonth]=useState(()=>today.slice(0,7));
 const { pending }=useFormStatus();
 const [year,monthNumber]=month.split("-").map(Number);
 const first=new Date(year,monthNumber-1,1).getDay();
 const days=new Date(year,monthNumber,0).getDate();
 function move(offset:number){const d=new Date(year,monthNumber-1+offset,1);setMonth(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));}
 function toggle(date:string){setDates(previous=>previous.includes(date)?previous.filter(d=>d!==date):previous.length>=366?previous:[...previous,date].sort());}
 const format=(date:string)=>date.replace(/-/g,"/");
 return <fieldset className={styles.workDates}>
 <legend>希望勤務日（複数選択）</legend>
 <p className={styles.hint}>勤務できる日を選んでください。もう一度押すと解除できます。</p>
 <div className={styles.calendarHeading}><button type="button" className="btn" disabled={pending||month<=today.slice(0,7)} onClick={()=>move(-1)} aria-label="前の月">‹</button><strong>{year}年{monthNumber}月</strong><button type="button" className="btn" disabled={pending} onClick={()=>move(1)} aria-label="次の月">›</button></div>
 <div className={styles.calendarGrid}>{["日","月","火","水","木","金","土"].map(d=><span key={d} className={styles.weekDay}>{d}</span>)}
 {Array.from({length:first},(_,i)=><span key={"blank"+i} aria-hidden="true"/>)}
 {Array.from({length:days},(_,i)=>{const day=i+1,date=month+"-"+String(day).padStart(2,"0"),selected=dates.includes(date);return <button key={date} type="button" className={selected?styles.selectedDay:styles.day} aria-pressed={selected} aria-label={format(date)+(selected?" 選択済み":"")} disabled={pending||date<today||(!selected&&dates.length>=366)} onClick={()=>toggle(date)}>{day}</button>;})}
 </div>
 <p className={styles.hint} aria-live="polite">{dates.length ? dates.length+"日を選択中" : "希望勤務日は未選択です。"}</p>
 <div className={styles.dateChips}>{dates.map(date=><span key={date}><input type="hidden" name="availableDates" value={date}/><button type="button" disabled={pending} onClick={()=>toggle(date)} aria-label={format(date)+"を解除"}>{format(date)} ×</button></span>)}</div>
 </fieldset>;
}

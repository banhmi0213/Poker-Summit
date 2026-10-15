"use client";
import { useState } from "react";
import { DEALER_HOURLY_WAGES } from "@/lib/dealer-wage";
import styles from "./dealer.module.css";
export function DealerWageField({initialMin, initialMax}: {initialMin: number | null; initialMax: number | null}) {
 const [min,setMin] = useState(initialMin === null ? "" : String(initialMin));
 const [max,setMax] = useState(initialMax === null ? "" : String(initialMax));
 return <fieldset className={styles.wageField}><legend>希望時給</legend><div className={styles.wageRange}>
 <label className={styles.field}>下限<select name="desiredHourlyWageMin" value={min} onChange={e=>{const value=e.target.value;setMin(value);if(!value)setMax("");else if(!max || Number(max)<Number(value))setMax(value);}}><option value="">未設定</option>{DEALER_HOURLY_WAGES.map(w=><option key={w} value={w}>{w.toLocaleString("ja-JP")}円</option>)}</select></label>
 <span aria-hidden="true">〜</span>
 <label className={styles.field}>上限<select name="desiredHourlyWageMax" value={max} onChange={e=>{const value=e.target.value;setMax(value);if(!value)setMin("");else if(!min || Number(min)>Number(value))setMin(value);}}><option value="">未設定</option>{DEALER_HOURLY_WAGES.map(w=><option key={w} value={w}>{w.toLocaleString("ja-JP")}円</option>)}</select></label>
 </div><p className={styles.hint}>店舗のディーラー検索・プロフィールに表示されます。</p></fieldset>;
}

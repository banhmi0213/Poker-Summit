"use client";
import { useState } from "react";
import { DEALER_REGION_GROUPS } from "@/lib/dealer-regions";
import { PREF_OPTIONS } from "@/lib/constants";
import styles from "./dealer.module.css";

export function DealerRegionField({ initial, required }: { initial: string[]; required: boolean }) {
 const [selected, setSelected] = useState<string[]>(initial);
 function toggle(prefs: string[]) {
  setSelected(current => {
   const next = new Set(current);
   if (prefs.every(p => next.has(p))) prefs.forEach(p => next.delete(p));
   else prefs.forEach(p => next.add(p));
   return PREF_OPTIONS.filter(p => next.has(p));
  });
 }
 return <fieldset className={styles.regionField}>
  <legend>対応可能地域{required ? " *" : "（任意）"}（複数選択）</legend>
  <p className={styles.hint}>選択した地域の店舗検索に表示されます。居住地とは別に、実際に勤務できる都道府県を選んでください。</p>
  <div className={styles.regionActions}><button type="button" onClick={() => setSelected([...PREF_OPTIONS])}>全国を選択</button><button type="button" onClick={() => setSelected([])}>選択を解除</button></div>
  {selected.map(p => <input key={p} type="hidden" name="availablePrefectures" value={p} />)}
  {DEALER_REGION_GROUPS.map((group, index) => <details key={group.name} className={styles.regionGroup} open={group.prefs.some(p => selected.includes(p)) || (required && !selected.length && index === 0)}>
   <summary>{group.name}（{group.prefs.filter(p => selected.includes(p)).length}県選択）</summary>
   <button type="button" onClick={() => toggle(group.prefs)}>{group.prefs.every(p => selected.includes(p)) ? "この地方を解除" : "この地方をまとめて選択"}</button>
   <div className={styles.regionChoices}>{group.prefs.map((p, i) => <label key={p}><input type="checkbox" checked={selected.includes(p)} onChange={() => toggle([p])} required={required && !selected.length && index === 0 && i === 0} />{p}</label>)}</div>
  </details>)}
  <p className={styles.hint} aria-live="polite">{selected.length ? `選択中：${selected.join("・")}` : required ? "対応可能な都道府県を1つ以上選択してください。" : "未選択"}</p>
 </fieldset>;
}

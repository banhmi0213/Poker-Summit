"use client";
import { useState, type ReactNode } from "react";
export function StoreEventFilter({dates, children}: {dates: (string | null)[]; children: ReactNode[]}) {
  const [period,setPeriod] = useState("all");
  const [order,setOrder] = useState("asc");
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", {timeZone:"Asia/Tokyo"});
  const indexes = dates.map((date,index)=>({date,index})).filter(({date}) => {
    if(period === "all") return true;
    if(!date) return false;
    const key = new Date(date).toLocaleDateString("en-CA",{timeZone:"Asia/Tokyo"});
    if(period === "today") return key === today;
    if(period === "month") return key.slice(0,7) === today.slice(0,7);
    const start = new Date(`${today}T00:00:00+09:00`).getTime();
    const time = new Date(date).getTime();
    return time >= start && time < start + 7*86400000;
  }).sort((a,b) => (new Date(a.date || 0).getTime()-new Date(b.date || 0).getTime())*(order === "asc" ? 1 : -1));
  return <><div className="sd-event-filters">{[["all","すべて"],["today","今日"],["week","今後7日"],["month","今月"]].map(([value,label]) => <button type="button" key={value} aria-pressed={period === value} onClick={()=>setPeriod(value)}>{label}</button>)}<select aria-label="イベントの並び順" value={order} onChange={event=>setOrder(event.target.value)}><option value="asc">開催日時順</option><option value="desc">開催日時が遅い順</option></select></div><div className="sd-events-grid">{indexes.map(({index})=>children[index])}</div>{!indexes.length && <p className="sd-empty">この期間の開催予定はありません。</p>}</>;
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { DetailIcon } from "./detail-icon";
type Event = {id: string; title: string; start_at: string | null};
export function StoreSchedule({events}: {events: Event[]}) {
  const [expanded, setExpanded] = useState(false);
  const initial = new Date().toLocaleDateString("en-CA", {timeZone: "Asia/Tokyo"});
  const [month, setMonth] = useState(() => initial.slice(0,7));
  const [selected, setSelected] = useState<string | null>(null);
  const [year, number] = month.split("-").map(Number);
  const days = new Date(year, number, 0).getDate();
  const offset = new Date(year, number-1, 1).getDay();
  const dateKey = (value: string) => new Date(value).toLocaleDateString("en-CA", {timeZone: "Asia/Tokyo"});
  const matches = events.filter(event => event.start_at && dateKey(event.start_at).startsWith(month) && (!selected || dateKey(event.start_at) === selected));
  // 閉じているときは「今日を含む今週(日〜土)」を正しい曜日で出す
  const [ty, tm, td] = initial.split("-").map(Number);
  const weekStart = new Date(Date.UTC(ty, tm - 1, td));
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  function move(step: number) {const d = new Date(year, number-1+step, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); setSelected(null);}
  return <section className={`sd-schedule ${expanded ? "is-expanded" : ""}`}>
    <div className="sd-schedule-heading"><DetailIcon name="calendar" /><div><h2>トーナメント・イベント</h2><p>日付を押すと、その日の開催予定を確認できます。</p></div></div>
    <div className="sd-calendar"><div className="sd-calendar-heading">{expanded && <button aria-label="前の月" onClick={() => move(-1)}>‹</button>}<strong>{year}年{number}月</strong>{expanded && <button aria-label="次の月" onClick={() => move(1)}>›</button>}</div>
      <div className="sd-calendar-days">{["日","月","火","水","木","金","土"].map(day => <span key={day}>{day}</span>)}
        {expanded && Array.from({length: offset}, (_,i) => <span key={`empty-${i}`} />)}
        {(expanded ? Array.from({length: days}, (_,i) => `${month}-${String(i+1).padStart(2,"0")}`) : week).map(key => {const m = Number(key.slice(5,7)); const d = Number(key.slice(8,10)); const hasEvent = events.some(event => event.start_at && dateKey(event.start_at) === key);return <button key={key} aria-label={`${m}月${d}日${hasEvent ? " イベントあり" : ""}`} aria-pressed={selected === key} className={`${hasEvent ? "has-event" : ""} ${key === initial ? "is-today" : ""}`} onClick={() => {setExpanded(true); setMonth(key.slice(0,7)); setSelected(selected === key ? null : key);}}>{!expanded && d === 1 ? `${m}/${d}` : d}</button>;})}</div></div>
    <button type="button" className="btn sd-schedule-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><DetailIcon name="calendar" />{expanded ? "スケジュールを閉じる" : "スケジュールを拡大"}</button>
    {expanded && <div className="sd-schedule-events">{matches.length ? matches.map(event => <Link key={event.id} href={`/events/${event.id}`}>{dateKey(event.start_at!)}　{event.title} ›</Link>) : <p>この期間の開催予定はありません。</p>}</div>}
  </section>;
}

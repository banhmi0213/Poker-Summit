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
  function move(step: number) {const d = new Date(year, number-1+step, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); setSelected(null);}
  return <section className={`sd-schedule ${expanded ? "is-expanded" : ""}`}>
    <div className="sd-schedule-heading"><DetailIcon name="calendar" /><div><h2>月間スケジュール</h2><p>今月のイベント・トーナメント開催予定をご確認いただけます。</p></div></div>
    <div className="sd-calendar"><div className="sd-calendar-heading">{expanded && <button aria-label="前の月" onClick={() => move(-1)}>‹</button>}<strong>{year}年{number}月</strong>{expanded && <button aria-label="次の月" onClick={() => move(1)}>›</button>}</div>
      <div className="sd-calendar-days">{["日","月","火","水","木","金","土"].map(day => <span key={day}>{day}</span>)}
        {expanded && Array.from({length: offset}, (_,i) => <span key={`empty-${i}`} />)}
        {Array.from({length: expanded ? days : 7}, (_,i) => {const key = `${month}-${String(i+1).padStart(2,"0")}`; const hasEvent = events.some(event => event.start_at && dateKey(event.start_at) === key);return <button key={key} aria-label={`${number}月${i+1}日${hasEvent ? " イベントあり" : ""}`} aria-pressed={selected === key} className={`${hasEvent ? "has-event" : ""} ${key === initial ? "is-today" : ""}`} onClick={() => {setExpanded(true); setSelected(selected === key ? null : key);}}>{i+1}</button>;})}</div></div>
    <button type="button" className="btn sd-schedule-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><DetailIcon name="calendar" />{expanded ? "スケジュールを閉じる" : "スケジュールを拡大"}</button>
    {expanded && <div className="sd-schedule-events">{matches.length ? matches.map(event => <Link key={event.id} href={`/events/${event.id}`}>{dateKey(event.start_at!)}　{event.title} ›</Link>) : <p>この期間の開催予定はありません。</p>}</div>}
  </section>;
}

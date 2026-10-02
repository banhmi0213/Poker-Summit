import { CompactPortalBanner } from "@/app/compact-portal-banner";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { PREF_OPTIONS } from "@/lib/constants";
import { PrefAreaSelect } from "@/app/pref-area-select";
import { ReferenceSlice } from "@/app/stores/[id]/reference-slice";

const kinds = ["すべて", "トーナメント", "イベント", "その他"];
function eventKind(e: any) {
  if (/大会|トーナメント|tournament/i.test(e.category ?? "")) return "トーナメント";
  if (/体験|講座|交流|イベント/.test(e.category ?? "")) return "イベント";
  if (/トーナメント|tournament/i.test(e.title ?? "")) return "トーナメント";
  return "その他";
}
function japanDate(value: string) {
  return new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
export default async function EventsPage({ searchParams }: {
  searchParams: { q?: string; pref?: string; area?: string; date?: string; category?: string; kind?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const pref = searchParams.pref ?? "";
  const area = pref ? searchParams.area ?? "" : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? searchParams.date! : "";
  const kind = kinds.includes(searchParams.kind ?? "") ? searchParams.kind! : "すべて";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("events").select("*, stores(name, pref, city, address)").eq("status", "published");
  let events = (data ?? []).filter((e: any) => {
    if (pref && e.stores?.pref !== pref && e.pref !== pref) return false;
    if (area && ![e.stores?.city, e.stores?.address, e.location].some(v => v?.includes(area))) return false;
    if (q && ![e.title, e.description, e.location, e.stores?.name].some(v => v?.toLowerCase().includes(q.toLowerCase()))) return false;
    if (date && (!e.start_at || japanDate(e.start_at) !== date)) return false;
    if (searchParams.category && e.category !== searchParams.category) return false;
    return kind === "すべて" || eventKind(e) === kind;
  });
  const now = new Date().toISOString();
  events = [...events].sort((a: any,b: any) => {
    const pastA = !!a.start_at && a.start_at < now, pastB = !!b.start_at && b.start_at < now;
    if (pastA !== pastB) return pastA ? 1 : -1;
    return pastA ? (b.start_at ?? "").localeCompare(a.start_at ?? "") : (a.start_at ?? "").localeCompare(b.start_at ?? "");
  });
  function tabHref(nextKind: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (pref) params.set("pref", pref);
    if (area) params.set("area", area);
    if (date) params.set("date", date);
    if (nextKind !== "すべて") params.set("kind", nextKind);
    return "/events" + (params.size ? "?" + params.toString() : "");
  }
  return <div>
    <PortalHeader userEmail={user?.email} />
    <main className="container ep-page">
      <CompactPortalBanner image="/images/compact-events.jpg" eyebrow="TOURNAMENTS & EVENTS" title="トーナメント・イベントを探す" subtitle="次の挑戦も、はじめての一歩も。" detail="" />
        <h1 className="portal-banner portal-banner--mobile" style={{ height: 190, overflow: "hidden", borderRadius: 10, margin: 0 }}>
        <Image
          src="/images/poker-events-banner.jpg"
          alt="TOURNAMENTS & EVENTS — トーナメント・イベントを探す。次の挑戦も、はじめての一歩も。"
          width={2172}
          height={724}
          priority
          sizes="(max-width: 1180px) 100vw, 1140px"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "fill" }}
        />
      </h1>
      <form method="get" className="ep-search">
        {kind !== "すべて" && <input type="hidden" name="kind" value={kind} />}
        <label className="ep-keyword">フリーワード<input name="q" defaultValue={q} placeholder="キーワードで検索" /></label>
        <div className="ep-location"><div className="ep-field-labels"><span>都道府県</span><span>エリア</span></div><div className="ep-location-selects"><PrefAreaSelect prefOptions={PREF_OPTIONS} prefLabel="都道府県" initialPref={pref} initialArea={area} /></div></div>
        <label>開催日<input name="date" type="date" defaultValue={date} /></label>
        <button type="submit" className="btn primary">検索</button>
      </form>
      <nav className="ep-kind-tabs" aria-label="イベントの種類">{kinds.map(label => <Link key={label} href={tabHref(label)} className={kind === label ? "active" : ""} aria-current={kind === label ? "page" : undefined}>{label}</Link>)}</nav>
      <div className="ep-list-heading"><h2>開催予定のイベント</h2><span>{events.length}件</span></div>
      {!events.length && <div className="empty">条件に合うイベントが見つかりませんでした。</div>}
      <div className="ep-grid">{events.map((e: any) => {
        const isPast = !!e.start_at && e.start_at < now;
        return <Link key={e.id} href={`/events/${e.id}`} className="ep-card" style={{opacity:isPast ? .62 : 1}}>
          <div className="ep-card-image">{e.banner_image_url ? <img src={e.banner_image_url} alt="" loading="lazy" /> : <><ReferenceSlice region={[200,70,480,240]} alt="" /><strong>{e.title}</strong></>}</div>
          <div className="ep-card-body"><div className="ep-date">{e.start_at ? <><strong>{new Date(e.start_at).toLocaleDateString("ja-JP",{month:"2-digit",day:"2-digit",timeZone:"Asia/Tokyo"})}</strong><span>{new Date(e.start_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"})}</span></> : <span>日時未定</span>}</div>
            <div className="ep-card-copy"><h3>{e.title}</h3>{e.stores?.name && <p>{e.stores.name}</p>}<p>{[e.stores?.pref,e.stores?.city].filter(Boolean).join("・") || e.location}</p><div className="ep-card-meta"><span>{eventKind(e)}</span>{isPast && <span>終了</span>}<b>詳細を見る ›</b></div></div>
          </div>
        </Link>;
      })}</div>
    </main>
    <PortalFooter /><BottomTabs />
  </div>;
}

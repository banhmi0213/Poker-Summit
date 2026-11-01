import { ReadableName } from "@/app/readable-name";
import { openingEmptyNote } from "@/lib/prelaunch";
import { isEventEnded } from "@/lib/event-end";
import { CompactPortalBanner } from "@/app/compact-portal-banner";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { REGIONS, PREF_REGION } from "@/lib/constants";
import { getDomesticTournamentEvents, matchesEventDate, matchesEventLocation } from "@/lib/major-tournament-events";
import { EventLocationSelect } from "./event-location-select";
import { EventSign } from "@/app/event-sign";
import { staticPageMetadata } from "@/lib/seo";

export const metadata = staticPageMetadata({ title: "ポーカーのトーナメント・イベント情報", description: "全国のアミューズメントポーカー店で開催されるトーナメント・イベント情報。開催日・エリア・店舗から次に参加する大会を探せます。", path: "/events" });

const kinds = ["すべて", "トーナメント", "イベント", "その他"];
function eventKind(e: any) {
  if (/大会|トーナメント|tournament/i.test(e.category ?? "")) return "トーナメント";
  if (/体験|講座|交流|イベント/.test(e.category ?? "")) return "イベント";
  if (/トーナメント|tournament/i.test(e.title ?? "")) return "トーナメント";
  return "その他";
}
export default async function EventsPage({ searchParams }: {
  searchParams: { q?: string; region?: string; pref?: string; area?: string; date?: string; category?: string; kind?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const region = REGIONS.includes(searchParams.region ?? "") ? searchParams.region! : "";
  const requestedPref = searchParams.pref ?? "";
  const pref = !region || PREF_REGION[requestedPref]?.includes(region) ? requestedPref : "";
  const area = pref ? searchParams.area ?? "" : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? searchParams.date! : "";
  const kind = kinds.includes(searchParams.kind ?? "") ? searchParams.kind! : "すべて";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const [{ data, error }, domesticEvents] = await Promise.all([
    supabase.from("events").select("*, stores(name, pref, city, address)").eq("status", "published"),
    getDomesticTournamentEvents(supabase, now),
  ]);
  if (error) throw new Error("イベントを読み込めませんでした。");
  let events: any[] = [...(data ?? []), ...domesticEvents].filter((e: any) => {
    if (isEventEnded(e, now)) return false; // 終わった大会・イベントは出さない(2026/10/18)
    if (!matchesEventLocation(e, { pref, region, area })) return false;
    if (q && ![e.title, e.description, e.location, e.stores?.name].some(v => v?.toLowerCase().includes(q.toLowerCase()))) return false;
    if (!matchesEventDate(e, date)) return false;
    if (searchParams.category && e.category !== searchParams.category) return false;
    return kind === "すべて" || eventKind(e) === kind;
  });
  events = [...events].sort((a: any,b: any) => {
    const pastA = !!(a.end_at || a.start_at) && (a.end_at || a.start_at) < now, pastB = !!(b.end_at || b.start_at) && (b.end_at || b.start_at) < now;
    if (pastA !== pastB) return pastA ? 1 : -1;
    return pastA ? (b.start_at ?? "").localeCompare(a.start_at ?? "") : (a.start_at ?? "").localeCompare(b.start_at ?? "");
  });
  function tabHref(nextKind: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (region) params.set("region", region);
    if (pref) params.set("pref", pref);
    if (area) params.set("area", area);
    if (date) params.set("date", date);
    if (nextKind !== "すべて") params.set("kind", nextKind);
    return "/events" + (params.size ? "?" + params.toString() : "");
  }
  return <div>
    <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ paddingTop: 12, paddingBottom: 0 }}><Link href="/" style={{ color: "#99742f", fontSize: 13, fontWeight: 600 }}>TOPに戻る</Link></div>
    <main className="container ep-page">
      <CompactPortalBanner image="/images/compact-events.webp" eyebrow="TOURNAMENTS & EVENTS" title="トーナメント・イベントを探す" titleParts={["トーナメント・", "イベントを探す"]} subtitle="次の挑戦も、はじめての一歩も。" detail="" />
        <div className="portal-banner portal-banner--mobile" style={{ height: 190, overflow: "hidden", borderRadius: 10, margin: 0 }}>
        <Image
          src="/images/poker-events-banner.webp"
          alt="TOURNAMENTS & EVENTS — トーナメント・イベントを探す。次の挑戦も、はじめての一歩も。"
          width={2172}
          height={724}
          priority
          sizes="(max-width: 1180px) 100vw, 1140px"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "fill" }}
        />
      </div>
      <form method="get" className="ep-search">
        {kind !== "すべて" && <input type="hidden" name="kind" value={kind} />}
        <label className="ep-keyword">フリーワード<input name="q" defaultValue={q} placeholder="キーワードで検索" /></label>
        <EventLocationSelect initialRegion={region} initialPref={pref} initialArea={area} />
        <label>開催日<input name="date" type="date" defaultValue={date} /></label>
        <button type="submit" className="btn primary">検索</button>
      </form>
      <nav className="ep-kind-tabs" aria-label="イベントの種類">{kinds.map(label => <Link key={label} href={tabHref(label)} className={kind === label ? "active" : ""} aria-current={kind === label ? "page" : undefined}>{label}</Link>)}</nav>
      <div className="ep-list-heading"><h2>開催予定のトーナメント・イベント</h2><span>{events.length}件</span></div>
      {!events.length && <div className="empty">条件に合うイベントが見つかりませんでした。{openingEmptyNote("イベント") && <><br />{openingEmptyNote("イベント")}</>}</div>}
      <div className="ep-grid">{events.map((e: any) => {
        const isPast = isEventEnded(e, now);
        const isLive = !!e.start_at && e.start_at <= now && !isPast;
        return <Link key={e.id} href={e.href || `/events/${e.id}`} className="ep-card">
          <div className="ep-card-image">{e.banner_image_url ? <img src={e.banner_image_url} alt="" loading="lazy" /> : <EventSign title={e.title} category={e.category} startAt={e.start_at} dateOnly={e.all_day} venue={e.stores?.name || e.location} />}</div>
          <div className="ep-card-body"><div className="ep-date">{e.start_at ? <><strong>{new Date(e.start_at).toLocaleDateString("ja-JP",{month:"2-digit",day:"2-digit",timeZone:"Asia/Tokyo"})}</strong><span>{e.all_day ? (e.end_date !== e.start_date ? `〜${e.end_date.slice(5).replace("-", "/")}` : "開催日") : new Date(e.start_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"})}</span></> : <span>日時未定</span>}</div>
            <div className="ep-card-copy"><h3><ReadableName name={e.title} /></h3>{e.stores?.name && <p><ReadableName name={e.stores.name} /></p>}<p>{[e.stores?.pref,e.stores?.city].filter(Boolean).join("・") || e.location}</p><div className="ep-card-meta"><span>{eventKind(e)}</span>{isPast ? <span>終了</span> : isLive ? <span>開催中</span> : null}<b>詳細を見る ›</b></div></div>
          </div>
        </Link>;
      })}</div>
    </main>
    <PortalFooter /><BottomTabs />
  </div>;
}

import { AREA_OPTIONS, PREF_OPTIONS, PREF_REGION } from "./constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MajorTournamentRow = {
  id: string; title: string; scope: string; active: boolean;
  location: string; venue: string; description: string | null;
  start_date: string | null; end_date: string | null;
};

// Official venue/access information. Match only within the venue's prefecture:
// a changed venue/location must not inherit another city's classification.
const VENUE_AREAS: { pref: string; venue: RegExp; area: string }[] = [
  { pref: "大阪府", venue: /なんばヒップス|DIJEST|難波御堂筋/i, area: "難波" },
  { pref: "大阪府", venue: /歌留多/, area: "心斎橋" },
  { pref: "大阪府", venue: /堂島リバーフォーラム/, area: "その他大阪" }, // 福島区
  { pref: "東京都", venue: /EBiS\s*303/i, area: "恵比寿" },
  { pref: "東京都", venue: /ベルサール(?:新宿グランド|高田馬場)/, area: "新宿" },
  { pref: "愛知県", venue: /中日(?:ビル|ホール)/, area: "栄・錦" },
  { pref: "愛知県", venue: /レジェンドホール|LEGEND\s*HALL/i, area: "その他愛知" }, // 大須
  { pref: "福岡県", venue: /UNITED\s*LAB/i, area: "天神・大名" },
  { pref: "鹿児島県", venue: /ライカ南国/, area: "鹿児島中央" },
  { pref: "広島県", venue: /NTTクレドホール/i, area: "八丁堀・紙屋町" },
  { pref: "宮城県", venue: /秋保.*クレセント/, area: "その他宮城" },
  { pref: "富山県", venue: /つるぎふれあい館/, area: "その他富山" },
];

export function tournamentGeography(row: Pick<MajorTournamentRow, "location" | "venue">) {
  const pref = PREF_OPTIONS.find(p => row.location.includes(p))
    ?? PREF_OPTIONS.find(p => row.venue.includes(p)) ?? "";
  const known = VENUE_AREAS.find(v => v.pref === pref && v.venue.test(row.venue));
  const text = `${row.location} ${row.venue}`;
  const areas = known ? [known.area] : (AREA_OPTIONS[pref] ?? []).filter(a =>
    !a.startsWith("その他") && a.split("・").some(part => text.includes(part)));
  return { pref, regions: PREF_REGION[pref] ?? [], areas };
}

export function toDomesticTournamentEvent(row: MajorTournamentRow, now: string) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(now));
  if (row.scope !== "国内" || !row.active || !row.start_date || (row.end_date || row.start_date) < today) return null;
  const geography = tournamentGeography(row);
  return {
    id: `major-${row.id}`, title: row.title, description: row.description,
    href: `/major-tournaments/${row.id}`, category: "トーナメント",
    location: [row.location, row.venue].filter(Boolean).join(" "),
    ...geography, all_day: true as const,
    // Boundaries are used for ordering/status only. Never display them as
    // officially announced start/finish times: the source holds dates only.
    start_at: new Date(`${row.start_date}T00:00:00+09:00`).toISOString(),
    end_at: new Date(`${row.end_date || row.start_date}T23:59:59.999+09:00`).toISOString(),
    start_date: row.start_date, end_date: row.end_date || row.start_date,
    banner_image_url: null, stores: null, store_id: null,
  };
}

export async function getDomesticTournamentEvents(db: SupabaseClient, now: string) {
  const { data, error } = await db.from("major_tournaments")
    .select("id,title,scope,active,location,venue,description,start_date,end_date")
    .eq("scope", "国内").eq("active", true).order("start_date");
  // A failed read must not take the whole page down (e.g. the staging database has no major_tournaments table): show no domestic majors instead.
  if (error) { console.error("国内大型大会を読み込めませんでした。", error.code ?? ""); return []; }
  return (data ?? []).map(row => toDomesticTournamentEvent(row, now)).filter((e): e is NonNullable<typeof e> => e !== null);
}

export function matchesEventLocation(e: any, filter: { pref?: string; region?: string; area?: string }) {
  const pref = e.stores?.pref || e.pref || "";
  if (filter.pref && pref !== filter.pref) return false;
  if (filter.region && !(PREF_REGION[pref] ?? []).includes(filter.region)) return false;
  if (!filter.area) return true;
  if (e.all_day) return e.areas.includes(filter.area);
  return [e.stores?.city, e.stores?.address, e.location].some(v => v?.includes(filter.area!));
}

export function matchesEventDate(e: any, date: string) {
  if (!date) return true;
  if (e.all_day) return e.start_date <= date && e.end_date >= date;
  return !!e.start_at && new Date(e.start_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) === date;
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchPlaces, getPlaceDetails, guessCategory, type PlaceCandidate } from "@/lib/google-places";
import { primaryRegionForPref } from "@/lib/constants";
import { normalizeCity } from "@/lib/city";
import { DEFAULT_EXCLUDE_KEYWORDS } from "@/app/admin/stores/import/keyword-tabs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/** 店名からポーカー店らしいと分かるもの(自動の見直しではこれだけを承認待ちに入れる) */
export const POKER_NAME_RE = /(ポーカー|poker|ホールデム|hold.?em|カジノ|casino|ぽーかー)/i;
const NG_NAME_RE = /(レンタル|スペース|rental|space|株式会社|（株）|\(株\)|POKER FACE|美容|パチ|スロット|slot)/i;

/**
 * 1地域をGoogle Placesで検索して、まだ登録のない店を status="pending"(承認待ち)で仮登録する。
 * 座標はGoogleのものを保存しない(規約上30日まで)。国土地理院で取り直す(geo_source=null)。
 */
export async function sweepArea(
  db: AnyClient,
  pref: string,
  area: string,
  opts: { keywords: string[]; onlyPokerNames?: boolean }
): Promise<{ found: number; inserted: string[] }> {
  const excludeWords = DEFAULT_EXCLUDE_KEYWORDS.split(/[,、\s]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const found = await Promise.all(
    opts.keywords.map((kw) => searchPlaces(area ? `${kw} ${area} ${pref}` : `${kw} ${pref}`).catch(() => [] as PlaceCandidate[]))
  );
  const merged = new Map<string, PlaceCandidate>();
  for (const list of found) for (const r of list) if (!merged.has(r.placeId)) merged.set(r.placeId, r);
  const results = Array.from(merged.values());

  const ids = results.map((r) => r.placeId);
  const { data: existing } = await db.from("stores").select("google_place_id").in("google_place_id", ids.length ? ids : ["-"]);
  const existingIds = new Set((existing ?? []).map((e: { google_place_id: string }) => e.google_place_id));

  const candidates = results.filter(
    (r) =>
      !existingIds.has(r.placeId) &&
      (!r.address || r.address.includes(pref)) &&
      r.businessStatus !== "CLOSED_PERMANENTLY" &&
      !excludeWords.some((w) => r.name.toLowerCase().includes(w)) &&
      (!opts.onlyPokerNames || (POKER_NAME_RE.test(r.name) && !NG_NAME_RE.test(r.name)))
  );

  const inserted: string[] = [];
  for (const c of candidates) {
    const details = await getPlaceDetails(c.placeId).catch(() => ({ city: null, tel: null }));
    const { error } = await db.from("stores").insert({
      name: c.name,
      status: "pending",
      category: guessCategory(c.name, c.types),
      pref,
      region: primaryRegionForPref(pref),
      city: normalizeCity(pref, details.city, c.address),
      address: c.address,
      tel: details.tel,
      google_place_id: c.placeId,
      google_business_status: c.businessStatus,
      google_match_status: "imported",
    });
    if (!error) inserted.push(c.name);
  }
  return { found: results.length, inserted };
}

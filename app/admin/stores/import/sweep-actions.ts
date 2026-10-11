"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { searchPlaces, getPlaceDetails, guessCategory, type PlaceCandidate } from "@/lib/google-places";
import { primaryRegionForPref } from "@/lib/constants";
import { normalizeCity } from "@/lib/city";
import { DEFAULT_EXCLUDE_KEYWORDS } from "./keyword-tabs";
import { SWEEP_KEYWORDS } from "./sweep-areas";

// 都道府県を細かい地域に分けて、Google Placesで取りこぼしなく探す一括検索(2026/10)。
// 1回の検索は最大60件しか返らないため、地域を細かく区切って何度も検索する。
// 見つかった新しい候補は通常の取り込みと同じく status="pending"(承認待ち)で仮登録する。
// 座標はGoogleのものを保存せず(規約上30日まで)、国土地理院で取り直す(geo_source=null)。
export async function sweepImportArea(pref: string, area: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください。");
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) throw new Error("運営権限がありません。");

  const excludeWords = DEFAULT_EXCLUDE_KEYWORDS.split(/[,、\s]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const found = await Promise.all(SWEEP_KEYWORDS.map((kw) => searchPlaces(area ? `${kw} ${area} ${pref}` : `${kw} ${pref}`).catch(() => [] as PlaceCandidate[])));
  const merged = new Map<string, PlaceCandidate>();
  for (const list of found) for (const r of list) if (!merged.has(r.placeId)) merged.set(r.placeId, r);
  const results = Array.from(merged.values());

  const ids = results.map((r) => r.placeId);
  const { data: existing } = await supabase.from("stores").select("google_place_id").in("google_place_id", ids.length ? ids : ["-"]);
  const existingIds = new Set((existing ?? []).map((e) => e.google_place_id));

  const candidates = results.filter(
    (r) =>
      !existingIds.has(r.placeId) &&
      (!r.address || r.address.includes(pref)) &&
      r.businessStatus !== "CLOSED_PERMANENTLY" &&
      !excludeWords.some((w) => r.name.toLowerCase().includes(w))
  );

  let inserted = 0;
  for (const c of candidates) {
    const details = await getPlaceDetails(c.placeId).catch(() => ({ city: null, tel: null }) as { city: string | null; tel: string | null });
    const { error } = await supabase.from("stores").insert({
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
    if (!error) inserted++;
  }

  await logAdminAction(supabase, "store_import_sweep", "store", undefined, { pref, area, found: results.length, inserted });
  revalidatePath("/admin/stores");
  return { found: results.length, inserted };
}

import { cookies, headers } from "next/headers";
import { PREF_OPTIONS, prefFromJisCode } from "@/lib/constants";

// "現在表示中の都道府県" (currently displayed prefecture) — a single, shared
// piece of state that the TOP page's region-linked sections (PICK UP店舗,
// 求人, クーポン, トーナメント/イベント, and any future region-linked content)
// all read from. This is completely separate from the existing 7-region map
// (app/poker-region-hero.tsx) and the /stores 地方→都道府県→エリア search
// flow (app/stores/page.tsx) — neither of those is touched by this file.
//
// Priority order, per spec:
//   1. A prefecture the visitor manually picked before (cookie, 1 year) —
//      once set, this always wins; geolocation/IP never override it.
//   2. A prefecture already resolved from geolocation this "session"
//      (cookie, 12 hours) — set by resolveGeoPref() in app/pref-actions.ts
//      after the client-side geo-detector successfully reverse-geocodes.
//   3. An IP-based guess from Vercel's free, automatic geolocation request
//      header (no cookie involved — this is just read fresh every request).
//   4. Nothing (全国 / nationwide) — the caller treats a null pref as "show
//      everything", not as an error.
export const CURRENT_PREF_MANUAL_COOKIE = "ps_pref_manual";
export const CURRENT_PREF_GEO_COOKIE = "ps_pref_geo";

// Sentinel value used in the <select> and in setCurrentPref() to mean
// "show 全国 (nationwide)" — distinct from "no preference set yet", because
// a visitor can explicitly choose 全国 and that choice should also stick.
export const ALL_PREF_SENTINEL = "ALL";

export type CurrentPrefSource = "manual" | "geo" | "ip" | "none";

function isValidPref(value: string | undefined | null): value is string {
  return !!value && PREF_OPTIONS.includes(value);
}

// Vercel's IP-geolocation request headers are free, automatic, and require
// no user permission prompt (unlike browser geolocation). For Japan,
// x-vercel-ip-country-region carries just the region portion of the ISO
// 3166-2:JP code (e.g. "13" for Tokyo, "27" for Osaka) — the same numbering
// PREF_OPTIONS/prefFromJisCode already use. This header is absent entirely
// in local dev and behind some proxies, which is fine — it just means this
// source contributes nothing and the chain falls through to 全国.
async function ipGuessPref(): Promise<string | null> {
  const hdrs = await headers();
  const country = hdrs.get("x-vercel-ip-country");
  if (country !== "JP") return null;
  const regionCode = hdrs.get("x-vercel-ip-country-region");
  return prefFromJisCode(regionCode);
}

export async function getCurrentPref(): Promise<{
  pref: string | null;
  source: CurrentPrefSource;
}> {
  const jar = await cookies();

  const manual = jar.get(CURRENT_PREF_MANUAL_COOKIE)?.value;
  if (manual === ALL_PREF_SENTINEL) {
    return { pref: null, source: "manual" };
  }
  if (isValidPref(manual)) {
    return { pref: manual, source: "manual" };
  }

  const geo = jar.get(CURRENT_PREF_GEO_COOKIE)?.value;
  if (isValidPref(geo)) {
    return { pref: geo, source: "geo" };
  }

  const ipPref = await ipGuessPref();
  if (isValidPref(ipPref)) {
    return { pref: ipPref, source: "ip" };
  }

  return { pref: null, source: "none" };
}

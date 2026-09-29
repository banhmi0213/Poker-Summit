"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PREF_OPTIONS } from "@/lib/constants";
import { reverseGeocodeToPref } from "@/lib/geocode";
import {
  ALL_PREF_SENTINEL,
  CURRENT_PREF_GEO_COOKIE,
  CURRENT_PREF_MANUAL_COOKIE,
} from "@/lib/current-pref";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const TWELVE_HOURS_SECONDS = 60 * 60 * 12;

// Called from the <PrefSelector> dropdown when the visitor explicitly picks
// a prefecture (or 全国). Per spec, a manual choice always wins from here on:
// it's saved for a full year and the geo-guess cookie is cleared so a stale
// auto-detected value can never resurface once the manual cookie expires
// while still looking like "the visitor's own choice" for another 11+ months.
export async function setCurrentPref(pref: string) {
  if (pref !== ALL_PREF_SENTINEL && !PREF_OPTIONS.includes(pref)) {
    throw new Error("不正な都道府県です。");
  }

  const jar = await cookies();
  jar.set(CURRENT_PREF_MANUAL_COOKIE, pref, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
  });
  jar.delete(CURRENT_PREF_GEO_COOKIE);

  revalidatePath("/");
  revalidatePath("/stores/featured");
}

// Called by <PrefGeoDetector> after the browser's Geolocation API resolves
// coordinates client-side. Re-checks server-side (not just trusting the
// client's hasManualPref prop) that no manual choice already exists — a
// manual pick must never be silently overridden by geolocation, even if the
// two race on the same page load.
export async function resolveGeoPref(lat: number, lng: number): Promise<string | null> {
  const jar = await cookies();
  if (jar.get(CURRENT_PREF_MANUAL_COOKIE)?.value) {
    return null;
  }

  const pref = await reverseGeocodeToPref(lat, lng);
  if (!pref) return null;

  jar.set(CURRENT_PREF_GEO_COOKIE, pref, {
    maxAge: TWELVE_HOURS_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  revalidatePath("/");
  revalidatePath("/stores/featured");

  return pref;
}

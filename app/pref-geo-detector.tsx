"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { resolveGeoPref } from "./pref-actions";

/**
 * Invisible. If the visitor has no manual choice AND no still-fresh
 * geolocation result cached (the 12h ps_pref_geo cookie — see
 * lib/current-pref.ts), silently asks the browser for their location and, on
 * success, resolves it to a prefecture, caches it, and refreshes the page so
 * the region-linked sections pick it up. Any failure (permission denied, no
 * geolocation support, reverse-geocode miss, timeout) is silent — the page
 * has already rendered with the IP-guess/全国 fallback from getCurrentPref(),
 * so there's nothing to show an error for.
 *
 * skipDetect covers both "manual" and "geo" sources: without it, this would
 * re-ask the browser for a location (and re-hit the reverse-geocode API) on
 * every single page load even though a still-valid geo cookie already
 * answers the question — defeating the point of caching that result.
 */
export function PrefGeoDetector({ skipDetect }: { skipDetect: boolean }) {
  const attempted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (skipDetect) return;
    if (attempted.current) return;
    attempted.current = true;

    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolveGeoPref(position.coords.latitude, position.coords.longitude)
          .then((pref) => {
            if (pref) router.refresh();
          })
          .catch(() => {});
      },
      () => {
        // Denied/unavailable/timeout: fail silently, keep the IP/全国 fallback.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  }, [skipDetect, router]);

  return null;
}

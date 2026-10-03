"use client";

import { useTransition } from "react";
import { setCurrentPref } from "./pref-actions";

// Duplicated from lib/current-pref.ts (not imported from there) on purpose:
// that file has a top-level `import ... from "next/headers"`, which Next.js
// will pull into this component's client bundle if anything is imported
// from it here — even just this string constant — and fail the build with
// "You're importing a component that needs next/headers" (headers()/cookies()
// only work in Server Components). Keep this in sync with
// lib/current-pref.ts's ALL_PREF_SENTINEL by hand if that value ever changes.
const ALL_PREF_SENTINEL = "ALL";

/**
 * "現在表示中の都道府県" bar — sits on the TOP page, separate from (and below)
 * the existing 7-region map/hero. Lets the visitor see and change which
 * prefecture the region-linked sections below (PICK UP店舗/求人/クーポン/
 * イベント) are currently showing. Does not touch the 7-region map's own
 * tap-to-search behavior in any way.
 */
export function PrefSelector({
  currentPref,
  prefOptions,
}: {
  currentPref: string | null;
  prefOptions: string[];
}) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    startTransition(async () => {
      await setCurrentPref(value);
    });
  };

  return (
    <div className="ps-pref-selector" aria-label="現在表示中の都道府県">
      <span className="ps-pref-selector__label">現在の地域</span>
      <select
        className="ps-pref-selector__select"
        aria-label="現在の表示地域"
        value={currentPref ?? ALL_PREF_SENTINEL}
        onChange={handleChange}
        disabled={isPending}
      >
        <option value={ALL_PREF_SENTINEL}>全国</option>
        {prefOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}

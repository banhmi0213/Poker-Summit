"use client";

import { useState } from "react";
import { PREF_OPTIONS, PREF_REGION, PREF_REGION_ORDER, REGIONS } from "@/lib/constants";

export function RegionAreaFilters({ initialRegion, initialArea }: { initialRegion: string; initialArea: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [area, setArea] = useState(initialArea);
  const prefectures = region
    ? (PREF_REGION_ORDER[region] ?? PREF_OPTIONS.filter((pref) => PREF_REGION[pref]?.includes(region)))
    : PREF_OPTIONS;
  const style = { padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--surface-2)", fontSize: 13 };
  return (
    <>
      <select name="region" aria-label="地方" value={region} onChange={(event) => { setRegion(event.target.value); setArea(""); }} style={{ ...style, width: 150 }}>
        <option value="">地方: すべて</option>
        {REGIONS.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <select name="area" aria-label="エリア" value={area} onChange={(event) => setArea(event.target.value)} style={{ ...style, width: 220 }}>
        <option value="">エリア: すべて</option>
        {area && !prefectures.includes(area) && <option value={area}>{area}</option>}
        {prefectures.map((pref) => <option key={pref} value={pref}>{pref}</option>)}
      </select>
    </>
  );
}

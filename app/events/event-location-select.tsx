"use client";

import { useState } from "react";
import { AREA_OPTIONS, PREF_OPTIONS, PREF_REGION, REGIONS } from "@/lib/constants";

export function EventLocationSelect({ initialRegion, initialPref, initialArea }: {
  initialRegion: string; initialPref: string; initialArea: string;
}) {
  const [region, setRegion] = useState(initialRegion);
  const [pref, setPref] = useState(initialPref);
  const [area, setArea] = useState(initialArea);
  return <>
    <label>地方<select name="region" value={region} onChange={e => {
      const next = e.target.value; setRegion(next);
      if (pref && next && !PREF_REGION[pref]?.includes(next)) { setPref(""); setArea(""); }
    }}><option value="">すべて</option>{REGIONS.map(r => <option key={r}>{r}</option>)}</select></label>
    <label>都道府県<select name="pref" value={pref} onChange={e => { setPref(e.target.value); setArea(""); }}>
      <option value="">すべて</option>{PREF_OPTIONS.filter(p => !region || PREF_REGION[p]?.includes(region)).map(p => <option key={p}>{p}</option>)}
    </select></label>
    <label>エリア<select name="area" value={area} disabled={!pref} onChange={e => setArea(e.target.value)}>
      <option value="">すべて</option>{(AREA_OPTIONS[pref] ?? []).map(a => <option key={a}>{a}</option>)}
    </select></label>
  </>;
}

"use client";

import { useState } from "react";
import { AREA_OPTIONS } from "@/lib/constants";

const selectStyle = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  fontSize: 13,
  flex: "1 1 160px",
} as const;

/**
 * The 都道府県/エリア pair on the /stores filter form. Picking a prefecture
 * instantly swaps the second dropdown's options to that prefecture's
 * neighborhoods (client-side, no page reload) — both still submit as normal
 * <select> form fields (name="pref" / name="area") when the surrounding
 * <form> is submitted.
 */
export function PrefAreaSelect({
  prefOptions,
  prefLabel,
  initialPref,
  initialArea,
}: {
  prefOptions: string[];
  prefLabel: string;
  initialPref: string;
  initialArea: string;
}) {
  const [pref, setPref] = useState(initialPref);
  const areaOptions = pref ? AREA_OPTIONS[pref] ?? [] : [];

  return (
    <>
      <select
        name="pref"
        value={pref}
        onChange={(e) => setPref(e.target.value)}
        style={selectStyle}
      >
        <option value="">{prefLabel}: すべて</option>
        {prefOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {/* key={pref} remounts this select (resetting it to "エリア: すべて")
          whenever the prefecture changes, except on first render where it
          should keep whatever area came in from the URL. */}
      <select
        key={pref}
        name="area"
        defaultValue={pref === initialPref ? initialArea : ""}
        disabled={!pref}
        style={selectStyle}
      >
        <option value="">エリア: すべて</option>
        {areaOptions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </>
  );
}
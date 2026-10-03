"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import styles from "./home-search.module.css";
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
/** Keep mobile search filters collapsed until the keyword field is used. */
export function ExpandableSearchForm({ children, className = "search-box", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <form method="get" action="/stores" className={`${className} ${styles.collapsible}`} style={style}
      data-filters-expanded={expanded ? "true" : "false"}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.name === "q") setExpanded(true);
      }}
      onClickCapture={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.name === "q") setExpanded(true);
      }}>
      {children}
    </form>
  );
}
